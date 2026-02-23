import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader, MessageCircle, Sparkles, Zap, Shield, Users } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import LegalDocumentsModal, { TERMS_VERSION } from '../components/LegalDocumentsModal';
import './Login.css';

const LEGAL_ACCEPTANCE_KEY = 'gravity_legal_acceptance_version';
const SIGNIN_RATE_KEY = 'gravity_signin_rate_window';
const SIGNIN_WINDOW_MS = 10 * 60 * 1000;
const SIGNIN_MAX_ATTEMPTS = 6;

async function syncUserToFirestore(user, { legalAccepted = false } = {}) {
    const { doc, setDoc, getFirestore, serverTimestamp } = await import('firebase/firestore');
    const db = getFirestore();
    const payload = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastSeen: serverTimestamp(),
        security: {
            authProvider: 'google',
            lastLoginAt: serverTimestamp(),
            appCheckEnabled: Boolean(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
        },
    };

    if (legalAccepted) {
        payload.legal = {
            acceptedVersion: TERMS_VERSION,
            acceptedAt: serverTimestamp(),
        };
    }

    await setDoc(
        doc(db, 'users', user.uid),
        payload,
        { merge: true }
    );
}

function getKnownAccounts() {
    try {
        const parsed = JSON.parse(localStorage.getItem('knownAccounts') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function readSignInRateWindow() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SIGNIN_RATE_KEY) || 'null');
        if (!parsed || typeof parsed !== 'object') return { startedAt: Date.now(), count: 0 };
        if (typeof parsed.startedAt !== 'number' || typeof parsed.count !== 'number') {
            return { startedAt: Date.now(), count: 0 };
        }
        return parsed;
    } catch {
        return { startedAt: Date.now(), count: 0 };
    }
}

function updateSignInRateWindow(state) {
    localStorage.setItem(SIGNIN_RATE_KEY, JSON.stringify(state));
}

function recordSignInAttempt() {
    const now = Date.now();
    const current = readSignInRateWindow();
    const withinWindow = (now - current.startedAt) < SIGNIN_WINDOW_MS;
    const next = withinWindow
        ? { startedAt: current.startedAt, count: current.count + 1 }
        : { startedAt: now, count: 1 };
    updateSignInRateWindow(next);
}

function getSignInBlockRemainingMs() {
    const now = Date.now();
    const current = readSignInRateWindow();
    if ((now - current.startedAt) >= SIGNIN_WINDOW_MS) return 0;
    if (current.count < SIGNIN_MAX_ATTEMPTS) return 0;
    return SIGNIN_WINDOW_MS - (now - current.startedAt);
}

function clearSignInRateWindow() {
    localStorage.removeItem(SIGNIN_RATE_KEY);
}

const features = [
    { icon: Zap, text: 'Motion-rich interface tuned for desktop and mobile.' },
    { icon: Shield, text: 'Sharp contrast, less visual noise, and a clean accent system.' },
    { icon: Users, text: 'One-click Google auth with quick account switching.' },
];

export default function Login() {
    const [error, setError] = useState('');
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState('tos');
    const [acceptedLegal, setAcceptedLegal] = useState(() => {
        try {
            return localStorage.getItem(LEGAL_ACCEPTANCE_KEY) === TERMS_VERSION;
        } catch {
            return false;
        }
    });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const navigate = useNavigate();
    const knownAccounts = useMemo(() => getKnownAccounts(), []);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const setLegalAccepted = (next) => {
        setAcceptedLegal(next);
        try {
            if (next) localStorage.setItem(LEGAL_ACCEPTANCE_KEY, TERMS_VERSION);
            else localStorage.removeItem(LEGAL_ACCEPTANCE_KEY);
        } catch (_) { }
    };

    const signIn = async (loginHint) => {
        if (isSigningIn) return;
        setError('');

        if (!acceptedLegal) {
            setError('Please accept the Terms of Service and Privacy Policy before signing in.');
            return;
        }

        const blockRemainingMs = getSignInBlockRemainingMs();
        if (blockRemainingMs > 0) {
            const remainingMinutes = Math.max(1, Math.ceil(blockRemainingMs / 60000));
            setError(`Too many sign-in attempts. Try again in about ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
            return;
        }

        recordSignInAttempt();
        setIsSigningIn(true);
        try {
            const provider = new GoogleAuthProvider();
            if (loginHint) provider.setCustomParameters({ login_hint: loginHint });
            const result = await signInWithPopup(auth, provider);
            clearSignInRateWindow();
            await syncUserToFirestore(result.user, { legalAccepted: true });
            navigate('/');
        } catch (err) {
            if (import.meta.env.DEV) console.error('Sign-In Error:', err);
            if (err?.code === 'auth/popup-closed-by-user') {
                setError('Sign-in popup closed before authentication completed.');
            } else {
                setError(`Login failed: ${err?.message || 'Unknown authentication error.'}`);
            }
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <div className="login-shell">
            {/* Animated backgrounds */}
            <div className="login-background" aria-hidden="true">
                <motion.div
                    className="login-aurora login-aurora-one"
                    animate={{ x: [0, -100, -40, 0], y: [0, 50, -30, 0], scale: [1, 1.15, 0.92, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="login-aurora login-aurora-two"
                    animate={{ x: [0, 90, 45, 0], y: [0, -35, 28, 0], scale: [1, 0.88, 1.08, 1] }}
                    transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="login-aurora login-aurora-three"
                    animate={{ x: [0, 28, -60, 0], y: [0, -55, 25, 0], scale: [1, 1.1, 0.94, 1] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                />
                <motion.div
                    className="login-orbit-ring login-ring-one"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                    className="login-orbit-ring login-ring-two"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
                />
                <div className="login-grid" />
            </div>
            <div className="login-noise" aria-hidden="true" />

            <motion.main
                className="login-layout"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* === HERO SECTION === */}
                <motion.section
                    className="login-hero"
                    initial={{ opacity: 0, x: -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                >
                    <motion.div
                        className="login-hero-badge"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <Sparkles size={14} />
                        Fresh visual build — Nebula Dark
                    </motion.div>

                    <motion.h1
                        className="login-hero-title"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.38, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        Gravity Chat,<br />reimagined.
                    </motion.h1>

                    <motion.p
                        className="login-hero-subtitle"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.48, duration: 0.6 }}
                    >
                        A cleaner, faster, smoother social hub for your servers and DMs — now with a nebula-dark aesthetic.
                    </motion.p>

                    <div className="login-hero-points">
                        {features.map(({ icon: Icon, text }, i) => (
                            <motion.div
                                key={i}
                                className="login-hero-point"
                                initial={{ opacity: 0, x: -18 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.55 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div style={{
                                    width: '32px', height: '32px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(236,72,153,0.2))',
                                    border: '1px solid rgba(168,85,247,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Icon size={16} color="#c084fc" />
                                </div>
                                {text}
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                {/* === AUTH PANEL === */}
                <motion.section
                    className="glass-panel login-panel"
                    initial={{ opacity: 0, x: 28, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.18, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                    {/* Brand */}
                    <div className="login-brand">
                        <motion.div
                            className="login-logo-wrap"
                            whileHover={{ scale: 1.08, rotate: -4 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        >
                            <MessageCircle size={30} strokeWidth={2.2} />
                        </motion.div>
                        <div>
                            <h2>Welcome back</h2>
                            <p>Sign in to continue to Gravity.</p>
                        </div>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                className="login-error"
                                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Google Sign-in */}
                    <motion.button
                        type="button"
                        className="glossy-button login-primary-button"
                        onClick={() => signIn()}
                        disabled={isSigningIn}
                        whileHover={isSigningIn ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={isSigningIn ? undefined : { y: 0, scale: 0.99 }}
                    >
                        {isSigningIn ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                Continue with Google
                                <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>

                    <label className="login-legal-consent">
                        <input
                            type="checkbox"
                            checked={acceptedLegal}
                            onChange={(event) => setLegalAccepted(event.target.checked)}
                        />
                        <span>
                            I agree to the{' '}
                            <button
                                type="button"
                                className="login-footnote-link"
                                onClick={() => {
                                    setLegalTab('tos');
                                    setShowLegalModal(true);
                                }}
                            >
                                Terms of Service
                            </button>
                            {' '}and{' '}
                            <button
                                type="button"
                                className="login-footnote-link"
                                onClick={() => {
                                    setLegalTab('privacy');
                                    setShowLegalModal(true);
                                }}
                            >
                                Privacy Policy
                            </button>
                            .
                        </span>
                    </label>

                    {/* Quick Account Switch */}
                    {knownAccounts.length > 0 && (
                        <div className="login-account-switcher">
                            <div className="login-switch-title">
                                <span />
                                Quick Switch
                                <span />
                            </div>
                            <div className="login-account-list">
                                {knownAccounts.map((account, index) => (
                                    <motion.button
                                        key={account.uid}
                                        type="button"
                                        className="login-account-card"
                                        onClick={() => signIn(account.email)}
                                        disabled={isSigningIn}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.38 + index * 0.09, duration: 0.38 }}
                                        whileHover={isSigningIn ? undefined : { y: -1 }}
                                    >
                                        {account.photoURL ? (
                                            <div
                                                className="login-account-avatar"
                                                style={{ backgroundImage: `url(${account.photoURL})` }}
                                            />
                                        ) : (
                                            <div className="login-account-avatar login-account-avatar-fallback">
                                                {(account.displayName || '?').slice(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="login-account-meta">
                                            <strong>{account.displayName || 'Unknown user'}</strong>
                                            <span>{account.email}</span>
                                        </div>
                                        <ArrowRight size={14} color="var(--text-muted)" />
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="login-footnote">
                        By signing in, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </motion.section>
            </motion.main>

            <LegalDocumentsModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
                mobile={isMobile}
            />
        </div>
    );
}
