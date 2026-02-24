import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap, Star, Crown, CreditCard, ExternalLink } from 'lucide-react';
import { useSubscription, TIERS } from '../context/SubscriptionContext';
import { useState } from 'react';

const TIER_ICONS = { basic: Zap, pro: Star, max: Crown };

const TIER_FEATURES = {
    basic: [
        'Up to 10 servers',
        'Basic badge on your profile',
        'Priority support',
    ],
    pro: [
        'Up to 25 servers',
        'Pro badge on your profile',
        'Everything in Basic',
        'Early access to new features',
    ],
    max: [
        'Unlimited servers',
        'Max badge on your profile',
        'Everything in Pro',
        'Highest priority support',
        'Exclusive Max-only features',
    ],
};

function TierCard({ tierKey, isCurrentTier, onSelect, loading }) {
    const tier = TIERS[tierKey];
    const Icon = TIER_ICONS[tierKey];
    const features = TIER_FEATURES[tierKey];
    const isPro = tierKey === 'pro';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: tierKey === 'basic' ? 0 : tierKey === 'pro' ? 0.07 : 0.14 }}
            style={{
                flex: 1,
                minWidth: '200px',
                borderRadius: '16px',
                border: `2px solid ${isPro ? tier.color : isCurrentTier ? tier.color : 'var(--glass-border)'}`,
                backgroundColor: isPro ? `${tier.color}12` : 'var(--bg-tertiary)',
                padding: '24px 20px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: isPro ? `0 0 32px ${tier.color}33` : 'none',
            }}
        >
            {isPro && (
                <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: tier.color,
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 12px',
                    borderRadius: '20px',
                    letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                }}>
                    MOST POPULAR
                </div>
            )}

            {isCurrentTier && (
                <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '16px',
                    backgroundColor: tier.color,
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    letterSpacing: '0.06em',
                }}>
                    CURRENT
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    backgroundColor: `${tier.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon size={20} color={tier.color} />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: tier.color }}>
                        {tier.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        per month
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '22px' }}>
                    ${tier.price}
                </div>
            </div>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <Check size={14} color={tier.color} style={{ flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{f}</span>
                    </div>
                ))}
            </div>

            {/* Button */}
            <button
                onClick={() => !isCurrentTier && onSelect(tierKey)}
                disabled={isCurrentTier || loading}
                style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isCurrentTier ? 'var(--bg-primary)' : tier.color,
                    color: isCurrentTier ? 'var(--text-muted)' : 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: isCurrentTier ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transition: 'opacity 0.2s, transform 0.1s',
                }}
                onMouseEnter={(e) => { if (!isCurrentTier) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { if (!isCurrentTier) e.currentTarget.style.opacity = '1'; }}
            >
                {isCurrentTier ? 'Active plan' : `Upgrade to ${tier.label}`}
            </button>
        </motion.div>
    );
}

export default function SubscriptionModal() {
    const { isModalOpen, closeSubscriptionModal, tierKey, startCheckout, openBillingPortal } = useSubscription();
    const [loading, setLoading] = useState(false);

    const handleSelect = async (selectedTierKey) => {
        setLoading(true);
        await startCheckout(selectedTierKey);
        setLoading(false);
    };

    const handleManageBilling = async () => {
        setLoading(true);
        await openBillingPortal();
        setLoading(false);
    };

    const hasPaidPlan = tierKey !== 'free';

    return createPortal(
        <AnimatePresence>
            {isModalOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed', inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        zIndex: 3000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeSubscriptionModal(); }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            width: '100%',
                            maxWidth: '780px',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '20px',
                            border: '1px solid var(--glass-border)',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '28px 28px 0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>
                                    Gravity+
                                </h2>
                                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    Unlock more servers, badges, and features
                                </p>
                            </div>
                            <button onClick={closeSubscriptionModal} className="icon-btn">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tier cards */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            padding: '28px',
                            flexWrap: 'wrap',
                        }}>
                            {['basic', 'pro', 'max'].map((key) => (
                                <TierCard
                                    key={key}
                                    tierKey={key}
                                    isCurrentTier={tierKey === key}
                                    onSelect={handleSelect}
                                    loading={loading}
                                />
                            ))}
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '16px 28px 24px',
                            borderTop: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                        }}>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                                Payments are processed securely by Stripe. Cancel anytime.
                            </p>
                            {hasPaidPlan && (
                                <button
                                    onClick={handleManageBilling}
                                    disabled={loading}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--glass-border)',
                                        backgroundColor: 'transparent',
                                        color: 'var(--text-secondary)',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <CreditCard size={14} />
                                    Manage Billing
                                    <ExternalLink size={12} />
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
