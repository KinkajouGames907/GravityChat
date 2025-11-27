import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    User,
    Save,
    Loader,
    Trash2,
    AlertTriangle,
    Camera,
    ChevronLeft,
    LogOut,
    Users,
    Plus,
    Shield
} from 'lucide-react';
import { updateProfile, deleteUser, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { doc, setDoc, deleteDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import userAvatar from '../assets/user_avatar.png';

export default function SettingsModal({ isOpen, onClose, initialTab }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState(isOpen ? (initialTab || 'account') : 'account');
    const [displayName, setDisplayName] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Reset tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab || 'account');
        }
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName || '');
            setPhotoURL(currentUser.photoURL || '');
        }
    }, [currentUser, isOpen]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const tabs = [
        { id: 'account', label: 'My Account', icon: User },
        { id: 'privacy', label: 'Privacy & Safety', icon: Shield },
        { id: 'profiles', label: 'Profiles', icon: Users },
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true }
    ];

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            onClose();
        } catch (error) {
            console.error('Error signing out:', error);
            setMessage({ type: 'error', text: 'Failed to sign out' });
        }
    };

    const handleSave = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setIsLoading(true);
        setMessage(null);

        try {
            await updateProfile(user, {
                displayName: displayName,
                photoURL: photoURL
            });

            // Update Firestore user document
            const db = getFirestore();
            await setDoc(doc(db, 'users', user.uid), {
                displayName: displayName,
                photoURL: photoURL,
                email: user.email,
                lastSeen: new Date()
            }, { merge: true });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;

        const user = auth.currentUser;
        if (!user) return;

        setIsLoading(true);
        try {
            const db = getFirestore();
            await deleteDoc(doc(db, 'users', user.uid));
            await deleteUser(user);
            onClose();
        } catch (error) {
            console.error('Error deleting account:', error);
            setMessage({ type: 'error', text: 'Failed to delete account. You may need to re-login first.' });
        } finally {
            setIsLoading(false);
        }
    };

    {
        activeTab === 'privacy' && (
            <motion.div
                key="privacy"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
            >
                <h3 style={{ margin: '0 0 20px', color: 'white', fontSize: '18px' }}>
                    Privacy & Safety
                </h3>

                {/* Safety Toggles */}
                <div style={{ marginBottom: '32px' }}>
                    <h4 style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: '16px'
                    }}>
                        Safety Defaults
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                                Allow Direct Messages
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Allow direct messages from server members
                            </div>
                        </div>
                        <div style={{
                            width: '44px',
                            height: '24px',
                            backgroundColor: 'var(--success)',
                            borderRadius: '12px',
                            position: 'relative',
                            cursor: 'pointer'
                        }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                                Filter Explicit Content
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Automatically scan and delete explicit media
                            </div>
                        </div>
                        <div style={{
                            width: '44px',
                            height: '24px',
                            backgroundColor: 'var(--success)',
                            borderRadius: '12px',
                            position: 'relative',
                            cursor: 'pointer'
                        }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>
                </div>

                {/* Privacy Policy */}
                <div style={{
                    padding: '20px',
                    backgroundColor: 'rgba(29, 155, 240, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(29, 155, 240, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--accent)' }}>
                        <Shield size={20} />
                        <span style={{ fontWeight: 700 }}>Privacy Policy</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                        We value your privacy. Your data is stored securely on Google Firebase.
                        We do not sell your personal data to third parties.
                        Messages are encrypted in transit.
                        By using Gravity, you agree to our Terms of Service and Community Guidelines.
                    </p>
                </div>
            </motion.div>
        )
    }

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: isMobile ? '0' : '20px'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        style={{
                            width: isMobile ? '100%' : '90%',
                            maxWidth: isMobile ? '100%' : '600px',
                            height: isMobile ? '100%' : 'auto',
                            maxHeight: isMobile ? '100%' : '80vh',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: isMobile ? 0 : '20px',
                            border: isMobile ? 'none' : '1px solid var(--glass-border)',
                            boxShadow: isMobile ? 'none' : '0 25px 60px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative' // Ensure relative positioning for children
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: isMobile ? '16px' : '20px 24px',
                            paddingTop: isMobile ? 'calc(16px + env(safe-area-inset-top, 0px))' : '20px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexShrink: 0,
                            backgroundColor: 'var(--bg-tertiary)'
                        }}>
                            {isMobile && (
                                <button
                                    onClick={onClose}
                                    className="icon-btn"
                                    style={{ marginLeft: '-8px' }}
                                >
                                    <ChevronLeft size={24} />
                                </button>
                            )}
                            <h2 style={{
                                margin: 0,
                                fontSize: isMobile ? '18px' : '20px',
                                fontWeight: 700,
                                flex: 1
                            }}>
                                Settings
                            </h2>
                            {!isMobile && (
                                <button onClick={onClose} className="icon-btn">
                                    <X size={22} />
                                </button>
                            )}
                        </div>

                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            overflow: 'hidden'
                        }}>
                            {/* Sidebar / Tab Bar */}
                            <div style={{
                                width: isMobile ? '100%' : '180px',
                                backgroundColor: 'var(--bg-tertiary)',
                                padding: isMobile ? '12px 16px' : '16px',
                                borderRight: isMobile ? 'none' : '1px solid var(--glass-border)',
                                borderBottom: isMobile ? '1px solid var(--glass-border)' : 'none',
                                display: 'flex',
                                flexDirection: isMobile ? 'row' : 'column',
                                gap: '8px',
                                flexShrink: 0,
                                overflowX: isMobile ? 'auto' : 'visible'
                            }}>
                                {tabs.map(tab => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                width: isMobile ? 'auto' : '100%',
                                                padding: isMobile ? '10px 16px' : '12px 14px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                backgroundColor: activeTab === tab.id
                                                    ? tab.danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-dim)'
                                                    : 'transparent',
                                                color: activeTab === tab.id
                                                    ? tab.danger ? 'var(--danger)' : 'var(--accent)'
                                                    : tab.danger ? 'var(--danger)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: '14px',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <Icon size={18} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                                <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: isMobile ? 'none' : '1px solid var(--glass-border)' }}>
                                    <button
                                        onClick={handleSignOut}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            width: isMobile ? 'auto' : '100%',
                                            padding: isMobile ? '10px 16px' : '12px 14px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: 'var(--danger)',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <LogOut size={18} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{
                                flex: 1,
                                padding: isMobile ? '20px 16px' : '28px',
                                overflowY: 'auto',
                                WebkitOverflowScrolling: 'touch'
                            }}>
                                <AnimatePresence mode="wait">
                                    {activeTab === 'account' && (
                                        <motion.div
                                            key="account"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            {/* Avatar Preview */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '20px',
                                                marginBottom: '28px',
                                                padding: '20px',
                                                backgroundColor: 'var(--bg-tertiary)',
                                                borderRadius: '16px',
                                                border: '1px solid var(--glass-border)'
                                            }}>
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        borderRadius: '50%',
                                                        backgroundImage: `url(${photoURL || userAvatar})`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        border: '3px solid var(--accent)'
                                                    }} />
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: '-4px',
                                                        right: '-4px',
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '50%',
                                                        backgroundColor: 'var(--accent)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        border: '3px solid var(--bg-tertiary)'
                                                    }}>
                                                        <Camera size={14} color="white" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>
                                                        {displayName || 'Your Name'}
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                        {currentUser?.email}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Display Name */}
                                            <div style={{ marginBottom: '24px' }}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    color: 'var(--text-secondary)',
                                                    marginBottom: '10px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    Display Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    placeholder="Enter your display name"
                                                    style={{
                                                        width: '100%',
                                                        padding: '14px 16px',
                                                        backgroundColor: 'var(--bg-primary)',
                                                        border: '2px solid var(--glass-border)',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                        fontSize: '15px',
                                                        outline: 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                                                />
                                            </div>

                                            {/* Avatar URL */}
                                            <div style={{ marginBottom: '28px' }}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    color: 'var(--text-secondary)',
                                                    marginBottom: '10px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    Avatar URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={photoURL}
                                                    onChange={(e) => setPhotoURL(e.target.value)}
                                                    placeholder="https://example.com/avatar.png"
                                                    style={{
                                                        width: '100%',
                                                        padding: '14px 16px',
                                                        backgroundColor: 'var(--bg-primary)',
                                                        border: '2px solid var(--glass-border)',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                        fontSize: '15px',
                                                        outline: 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                                                />
                                                <p style={{
                                                    fontSize: '12px',
                                                    color: 'var(--text-muted)',
                                                    marginTop: '8px'
                                                }}>
                                                    Enter a direct link to an image file
                                                </p>
                                            </div>

                                            <button
                                                onClick={handleSave}
                                                disabled={isLoading || !displayName.trim()}
                                                className="glossy-button"
                                                style={{
                                                    width: '100%',
                                                    padding: '14px',
                                                    borderRadius: '12px',
                                                    opacity: (isLoading || !displayName.trim()) ? 0.5 : 1
                                                }}
                                            >
                                                {isLoading ? (
                                                    <Loader size={20} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <Save size={20} />
                                                        Save Changes
                                                    </>
                                                )}
                                            </button>
                                        </motion.div>
                                    )}

                                    {activeTab === 'profiles' && (
                                        <motion.div
                                            key="profiles"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <h3 style={{
                                                margin: '0 0 16px',
                                                color: 'white',
                                                fontSize: '18px'
                                            }}>
                                                Switch Accounts
                                            </h3>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {JSON.parse(localStorage.getItem('knownAccounts') || '[]').map((acc) => {
                                                    const isCurrent = acc.uid === currentUser?.uid;
                                                    return (
                                                        <div
                                                            key={acc.uid}
                                                            onClick={() => {
                                                                if (!isCurrent) handleSignOut();
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '12px',
                                                                padding: '12px',
                                                                backgroundColor: isCurrent ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                                                borderRadius: '12px',
                                                                border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                                                                cursor: isCurrent ? 'default' : 'pointer',
                                                                opacity: isCurrent ? 1 : 0.7,
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => !isCurrent && (e.currentTarget.style.opacity = 1)}
                                                            onMouseLeave={(e) => !isCurrent && (e.currentTarget.style.opacity = 0.7)}
                                                        >
                                                            <div style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                borderRadius: '50%',
                                                                backgroundImage: `url(${acc.photoURL || userAvatar})`,
                                                                backgroundSize: 'cover',
                                                                backgroundPosition: 'center',
                                                                border: '2px solid var(--glass-border)'
                                                            }} />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'white' }}>
                                                                    {acc.displayName}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                                    {acc.email}
                                                                </div>
                                                            </div>
                                                            {isCurrent && (
                                                                <div style={{
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: 'var(--accent)',
                                                                    backgroundColor: 'var(--accent-dim)',
                                                                    padding: '4px 8px',
                                                                    borderRadius: '6px'
                                                                }}>
                                                                    CURRENT
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                <button
                                                    onClick={handleSignOut}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        padding: '12px',
                                                        backgroundColor: 'transparent',
                                                        border: '1px dashed var(--text-muted)',
                                                        borderRadius: '12px',
                                                        color: 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        fontWeight: 600,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                                        e.currentTarget.style.color = 'var(--accent)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--text-muted)';
                                                        e.currentTarget.style.color = 'var(--text-muted)';
                                                    }}
                                                >
                                                    <Plus size={18} />
                                                    Add Another Account
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'danger' && (
                                        <motion.div
                                            key="danger"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <h3 style={{
                                                margin: '0 0 12px',
                                                color: 'var(--danger)',
                                                fontSize: '18px'
                                            }}>
                                                Delete Account
                                            </h3>
                                            <p style={{
                                                fontSize: '14px',
                                                color: 'var(--text-secondary)',
                                                lineHeight: '1.6',
                                                marginBottom: '24px'
                                            }}>
                                                Once you delete your account, there is no going back. Please be certain.
                                            </p>

                                            <div style={{
                                                padding: '16px',
                                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                marginBottom: '28px'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    color: 'var(--danger)',
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    marginBottom: '10px'
                                                }}>
                                                    <AlertTriangle size={18} />
                                                    Warning: This action is irreversible
                                                </div>
                                                <p style={{
                                                    fontSize: '13px',
                                                    color: 'var(--text-secondary)',
                                                    margin: 0,
                                                    lineHeight: '1.5'
                                                }}>
                                                    All your messages will remain, but your user profile and account data will be permanently removed.
                                                </p>
                                            </div>

                                            <button
                                                onClick={handleDeleteAccount}
                                                disabled={isLoading}
                                                style={{
                                                    width: '100%',
                                                    padding: '14px',
                                                    backgroundColor: 'var(--danger)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    fontSize: '15px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '10px',
                                                    opacity: isLoading ? 0.5 : 1,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {isLoading ? (
                                                    <Loader size={20} className="animate-spin" />
                                                ) : (
                                                    <>
                                                        <Trash2 size={20} />
                                                        Delete Account
                                                    </>
                                                )}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Status Message */}
                        <AnimatePresence>
                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    style={{
                                        padding: '14px 20px',
                                        backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
                                        textAlign: 'center',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        borderTop: '1px solid var(--glass-border)'
                                    }}
                                >
                                    {message.text}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
