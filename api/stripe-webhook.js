import Stripe from 'stripe';
import admin from 'firebase-admin';

// Initialise Firebase Admin once per cold start
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    // Vercel escapes newlines in env vars — restore them so the private key is valid
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// Map Stripe Price IDs → internal tier names (resolved at request time)
const getPriceToTier = () => ({
    [process.env.STRIPE_BASIC_PRICE_ID]: 'basic',
    [process.env.STRIPE_PRO_PRICE_ID]: 'pro',
    [process.env.STRIPE_MAX_PRICE_ID]: 'max',
});

// Read raw request body — required for Stripe signature verification
const getRawBody = (req) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        // Throws if the signature doesn't match — stops replay attacks & forged events
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).json({ error: `Webhook verification failed: ${err.message}` });
    }

    const db = admin.firestore();
    const priceToTier = getPriceToTier();

    try {
        switch (event.type) {

            // ── Payment completed → grant access immediately ──────────────────
            case 'checkout.session.completed': {
                const session = event.data.object;
                const uid = session.metadata?.firebaseUID;
                if (!uid) break;

                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                const priceId = subscription.items.data[0]?.price.id;
                const tier = priceToTier[priceId] || 'basic';

                await db.collection('users').doc(uid).update({
                    tier,
                    subscriptionId: session.subscription,
                    stripeCustomerId: session.customer,
                    subscriptionStatus: 'active',
                });
                break;
            }

            // ── Plan upgraded / downgraded / payment renewed ──────────────────
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const priceId = sub.items.data[0]?.price.id;
                const tier = priceToTier[priceId] || 'basic';

                const snap = await db.collection('users')
                    .where('stripeCustomerId', '==', sub.customer)
                    .limit(1)
                    .get();

                if (!snap.empty) {
                    await snap.docs[0].ref.update({
                        tier,
                        subscriptionStatus: sub.status,
                    });
                }
                break;
            }

            // ── Subscription cancelled / expired → revoke access ─────────────
            case 'customer.subscription.deleted': {
                const sub = event.data.object;

                const snap = await db.collection('users')
                    .where('stripeCustomerId', '==', sub.customer)
                    .limit(1)
                    .get();

                if (!snap.empty) {
                    await snap.docs[0].ref.update({
                        tier: 'free',
                        subscriptionStatus: 'cancelled',
                        subscriptionId: admin.firestore.FieldValue.delete(),
                    });
                }
                break;
            }

            // ── Payment failed → mark past_due (don't revoke immediately) ─────
            case 'invoice.payment_failed': {
                const invoice = event.data.object;

                const snap = await db.collection('users')
                    .where('stripeCustomerId', '==', invoice.customer)
                    .limit(1)
                    .get();

                if (!snap.empty) {
                    await snap.docs[0].ref.update({ subscriptionStatus: 'past_due' });
                }
                break;
            }

            default:
                break;
        }
    } catch (err) {
        // Log internally but always return 200 so Stripe doesn't keep retrying
        console.error('Webhook handler error:', err);
    }

    return res.status(200).json({ received: true });
}
