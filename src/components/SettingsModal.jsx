import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Save, Loader, Trash2, AlertTriangle } from 'lucide-react';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, setDoc, deleteDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function SettingsModal({ isOpen, onClose }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('account');
    const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
    const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleSave = async () => {
        if (!displayName.trim()) return;
        setIsLoading(true);
        setMessage(null);

        try {
            // 1. Update Auth Profile
            await updateProfile(currentUser, {
                displayName: displayName,
                photoURL: photoURL
            });

            // 2. Update Firestore User Document
            const db = getFirestore();
            const userRef = doc(db, "users", currentUser.uid);
            await setDoc(userRef, {
                displayName: displayName,
                photoURL: photoURL
            }, { merge: true });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setTimeout(() => {
                setMessage(null);
            }, 2000);
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("Are you sure you want to delete your account? This action is irreversible.")) return;

        setIsLoading(true);
        try {
            const db = getFirestore();
            // Delete Firestore Data
            await deleteDoc(doc(db, "users", currentUser.uid));

            // Delete Auth User
            await deleteUser(currentUser);
            onClose();
        } catch (error) {
            console.error("Error deleting account:", error);
            if (error.code === 'auth/requires-recent-login') {
                setMessage({ type: 'error', text: 'Please log out and log in again to delete your account.' });
            } else {
                setMessage({ type: 'error', text: 'Failed to delete account.' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(5px)',
                            zIndex: 50
                        }}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '90%',
                            maxWidth: '500px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            padding: '0',
                            zIndex: 51,
                            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {/* Header */}
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Settings</h2>
                            <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                        </div>

                        <div style={{ display: 'flex', minHeight: '300px' }}>
                            {/* Sidebar */}
                            <div style={{ width: '140px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRight: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => setActiveTab('account')}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        marginBottom: '4px',
                                        backgroundColor: activeTab === 'account' ? 'var(--bg-hover)' : 'transparent',
                                        color: activeTab === 'account' ? 'white' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px'
                                    }}
                                >
                                    My Account
                                </button>
                                <button
                                    onClick={() => setActiveTab('danger')}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        backgroundColor: activeTab === 'danger' ? 'rgba(244, 33, 46, 0.1)' : 'transparent',
                                        color: activeTab === 'danger' ? '#f4212e' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px'
                                    }}
                                >
                                    Danger Zone
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, padding: '24px' }}>
                                {activeTab === 'account' && (
                                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                                        <div style={{ marginBottom: '24px' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Display Name
                                            </label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    backgroundColor: 'var(--bg-primary)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '4px',
                                                    color: 'white',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                        <div style={{ marginBottom: '24px' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Avatar URL
                                            </label>
                                            <input
                                                type="text"
                                                value={photoURL}
                                                onChange={(e) => setPhotoURL(e.target.value)}
                                                placeholder="https://example.com/avatar.png"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    backgroundColor: 'var(--bg-primary)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '4px',
                                                    color: 'white',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        <button
                                            onClick={handleSave}
                                            disabled={isLoading}
                                            className="glossy-button"
                                            style={{ width: '100%', justifyContent: 'center' }}
                                        >
                                            {isLoading ? <Loader size={18} className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
                                        </button>
                                    </motion.div>
                                )}

                                {activeTab === 'danger' && (
                                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                                        <h3 style={{ marginTop: 0, color: '#f4212e' }}>Delete Account</h3>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            Once you delete your account, there is no going back. Please be certain.
                                        </p>

                                        <div style={{ padding: '12px', backgroundColor: 'rgba(244, 33, 46, 0.05)', borderRadius: '8px', border: '1px solid rgba(244, 33, 46, 0.2)', marginBottom: '24px' }}>
                                            <div style={{ display: 'flex', gap: '8px', color: '#f4212e', fontSize: '13px', fontWeight: 600 }}>
                                                <AlertTriangle size={16} /> Warning
                                            </div>
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                                                All your messages will remain, but your user profile will be removed.
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleDeleteAccount}
                                            disabled={isLoading}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                backgroundColor: '#f4212e',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            {isLoading ? <Loader size={18} className="animate-spin" /> : <><Trash2 size={18} /> Delete Account</>}
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {message && (
                            <div style={{
                                padding: '10px',
                                backgroundColor: message.type === 'success' ? 'rgba(0, 186, 124, 0.1)' : 'rgba(244, 33, 46, 0.1)',
                                color: message.type === 'success' ? '#00ba7c' : '#f4212e',
                                textAlign: 'center',
                                fontSize: '13px',
                                borderTop: '1px solid var(--glass-border)'
                            }}>
                                {message.text}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
