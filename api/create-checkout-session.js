import Stripe from 'stripe';

const ALLOWED_PRICE_IDS = () =>
    [
        process.env.STRIPE_BASIC_PRICE_ID,
        process.env.STRIPE_PRO_PRICE_ID,
        process.env.STRIPE_MAX_PRICE_ID,
    ].filter(Boolean);

const getRawBody = (req) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    let body;
    try {
        const raw = await getRawBody(req);
        body = JSON.parse(raw.toString());
    } catch {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    const { priceId, userId, userEmail } = body;

    if (!priceId || !userId || !userEmail) {
        return res.status(400).json({ error: 'Missing required fields: priceId, userId, userEmail' });
    }

    // Whitelist — only allow our known price IDs (prevents price tampering)
    if (!ALLOWED_PRICE_IDS().includes(priceId)) {
        return res.status(400).json({ error: 'Invalid price' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const appUrl = process.env.VITE_APP_URL || 'https://gravitychat.vercel.app';

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            customer_email: userEmail,
            // Store Firebase UID in metadata — the webhook uses this to update Firestore
            metadata: { firebaseUID: userId },
            success_url: `${appUrl}?subscription=success`,
            cancel_url: `${appUrl}?subscription=cancelled`,
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
