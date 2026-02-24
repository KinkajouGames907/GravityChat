import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

// ── Tier definitions ──────────────────────────────────────────────────────────
export const TIERS = {
    free: {
        id: 'free',
        label: 'Free',
        price: 0,
        color: '#6b7280',
        maxServers: 5,
        maxImageSize: 10 * 1024 * 1024,   // 10 MB
        maxGifSize:   15 * 1024 * 1024,   // 15 MB
        maxFileSize:  25 * 1024 * 1024,   // 25 MB
        badge: null,
    },
    basic: {
        id: 'basic',
        label: 'Basic',
        price: 5,
        color: '#3b82f6',
        maxServers: 10,
        maxImageSize: 10 * 1024 * 1024,
        maxGifSize:   15 * 1024 * 1024,
        maxFileSize:  25 * 1024 * 1024,
        badge: 'Basic',
        priceEnvKey: 'VITE_STRIPE_BASIC_PRICE_ID',
    },
    pro: {
        id: 'pro',
        label: 'Pro',
        price: 10,
        color: '#a855f7',
        maxServers: 25,
        maxImageSize: 10 * 1024 * 1024,
        maxGifSize:   15 * 1024 * 1024,
        maxFileSize:  25 * 1024 * 1024,
        badge: 'Pro',
        priceEnvKey: 'VITE_STRIPE_PRO_PRICE_ID',
    },
    max: {
        id: 'max',
        label: 'Max',
        price: 20,
        color: '#f59e0b',
        maxServers: Infinity,
        maxImageSize: 10 * 1024 * 1024,
        maxGifSize:   15 * 1024 * 1024,
        maxFileSize:  25 * 1024 * 1024,
        badge: 'Max',
        priceEnvKey: 'VITE_STRIPE_MAX_PRICE_ID',
    },
};

// ── Context ───────────────────────────────────────────────────────────────────
const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
    const { currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Tier comes from Firestore via AuthContext (currentUser.tier)
    // Only the backend webhook can write this field — clients cannot fake it
    const tierKey = currentUser?.tier && TIERS[currentUser.tier] ? currentUser.tier : 'free';
    const tier = TIERS[tierKey];

    const openSubscriptionModal = useCallback(() => setIsModalOpen(true), []);
    const closeSubscriptionModal = useCallback(() => setIsModalOpen(false), []);

    // ── Checkout ─────────────────────────────────────────────────────────────
    const startCheckout = useCallback(async (targetTierKey) => {
        const targetTier = TIERS[targetTierKey];
        if (!targetTier || !targetTier.priceEnvKey) return;

        const priceId = import.meta.env[targetTier.priceEnvKey];
        if (!priceId) {
            console.warn('Stripe price ID not configured for:', targetTierKey);
            return;
        }

        try {
            const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId,
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else console.error('Checkout error:', data.error);
        } catch (err) {
            console.error('Failed to start checkout:', err);
        }
    }, [currentUser]);

    // ── Manage billing (Stripe portal) ───────────────────────────────────────
    const openBillingPortal = useCallback(async () => {
        try {
            const res = await fetch('/api/customer-portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.uid }),
            });
            const data = await res.json();
            if (data.url) window.open(data.url, '_blank');
            else console.error('Portal error:', data.error);
        } catch (err) {
            console.error('Failed to open billing portal:', err);
        }
    }, [currentUser]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const canJoinServer = useCallback((currentServerCount) => {
        if (tier.maxServers === Infinity) return true;
        return currentServerCount < tier.maxServers;
    }, [tier]);

    const canUploadFile = useCallback((bytes, type) => {
        if (type === 'image/gif') return bytes <= tier.maxGifSize;
        if (type?.startsWith('image/')) return bytes <= tier.maxImageSize;
        return bytes <= tier.maxFileSize;
    }, [tier]);

    return (
        <SubscriptionContext.Provider value={{
            tier,
            tierKey,
            isModalOpen,
            openSubscriptionModal,
            closeSubscriptionModal,
            startCheckout,
            openBillingPortal,
            canJoinServer,
            canUploadFile,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
    return ctx;
}
