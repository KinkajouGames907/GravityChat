import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function Login() {
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        console.log("Attempting Google Sign-In...");
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Sync user to Firestore
            const { doc, setDoc, getFirestore } = await import('firebase/firestore');
            const db = getFirestore();
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                lastSeen: new Date()
            }, { merge: true });

            console.log("Sign-In Successful:", user);
            navigate('/');
        } catch (err) {
            console.error("Sign-In Error:", err);
            setError(`Login Failed: ${err.message}`);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--bg-primary)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Ambient Glow */}
            <div style={{
                position: 'absolute',
                top: '-20%',
                left: '-10%',
                width: '50%',
                height: '50%',
                background: 'radial-gradient(circle, rgba(29, 155, 240, 0.15) 0%, transparent 70%)',
                filter: 'blur(60px)',
                zIndex: 0
            }} />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="glass-panel"
                style={{
                    padding: '40px',
                    borderRadius: '24px',
                    width: '100%',
                    maxWidth: '400px',
                    textAlign: 'center',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}
            >
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}
                >
                    <div style={{
                        background: 'var(--text-primary)',
                        borderRadius: '50%',
                        padding: '12px',
                        display: 'flex',
                        boxShadow: '0 0 20px rgba(255,255,255,0.2)'
                    }}>
                        <MessageCircle size={40} color="black" fill="black" />
                    </div>
                </motion.div>

                <div>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800 }}>Gravity</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>The center of your universe.</p>
                </div>

                {error && (
                    <div style={{ color: 'var(--danger)', fontSize: '14px', background: 'rgba(244, 33, 46, 0.1)', padding: '10px', borderRadius: '8px' }}>
                        {error}
                    </div>
                )}

                <button
                    className="glossy-button"
                    onClick={handleGoogleLogin}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    Sign in with Google <ArrowRight size={18} />
                </button>

                {/* Quick Login for Known Accounts */}
                {(() => {
                    const knownAccounts = JSON.parse(localStorage.getItem('knownAccounts') || '[]');
                    if (knownAccounts.length === 0) return null;

                    return (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                margin: '10px 0 5px'
                            }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                                SWITCH ACCOUNTS
                                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                            </div>

                            {knownAccounts.map(acc => (
                                <button
                                    key={acc.uid}
                                    onClick={async () => {
                                        console.log("Attempting Quick Login for:", acc.email);
                                        setError('');
                                        try {
                                            const provider = new GoogleAuthProvider();
                                            provider.setCustomParameters({ login_hint: acc.email });
                                            const result = await signInWithPopup(auth, provider);
                                            // Sync user to Firestore
                                            const user = result.user;
                                            const { doc, setDoc, getFirestore } = await import('firebase/firestore');
                                            const db = getFirestore();
                                            await setDoc(doc(db, "users", user.uid), {
                                                uid: user.uid,
                                                displayName: user.displayName,
                                                email: user.email,
                                                photoURL: user.photoURL,
                                                lastSeen: new Date()
                                            }, { merge: true });
                                            navigate('/');
                                        } catch (err) {
                                            console.error("Quick Login Error:", err);
                                            setError(`Login Failed: ${err.message}`);
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        color: 'white',
                                        textAlign: 'left',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundImage: `url(${acc.photoURL})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        border: '1px solid var(--glass-border)'
                                    }} />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {acc.displayName}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {acc.email}
                                        </div>
                                    </div>
                                    <ArrowRight size={14} color="var(--text-muted)" />
                                </button>
                            ))}
                        </div>
                    );
                })()}

                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
            </motion.div>
        </div>
    );
}
