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
    Shield,
    Smile
} from 'lucide-react';
import { updateProfile, deleteUser, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, getFirestore, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../context/SoundContext';
import userAvatar from '../assets/user_avatar.png';
import { storage } from '../lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEmoji } from '../context/EmojiContext';
import { customEmojis as hardcodedEmojis } from '../utils/customEmojis'; // Keep for fallback or migration

export default function SettingsModal({ isOpen, onClose, initialTab }) {
    const { currentUser, updateUserStatus } = useAuth();
    const { isMuted, toggleMute } = useSound();
    const [activeTab, setActiveTab] = useState(isOpen ? (initialTab || 'account') : 'account');
    const [displayName, setDisplayName] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [username, setUsername] = useState('');
    const [currentUsername, setCurrentUsername] = useState('');
    const [bio, setBio] = useState('');
    const [bannerURL, setBannerURL] = useState('');
    const [profileTheme, setProfileTheme] = useState('');
    const [profileAccent, setProfileAccent] = useState('');
    const [customStatus, setCustomStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Emoji Upload State
    const [emojiFile, setEmojiFile] = useState(null);
    const [emojiName, setEmojiName] = useState('');
    const [isUploadingEmoji, setIsUploadingEmoji] = useState(false);
    const { customEmojis } = useEmoji();

    // Helper to resize image and convert to Base64
    const resizeImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 128;
                    const MAX_HEIGHT = 128;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleEmojiUpload = async (e) => {
        e.preventDefault();
        if (!emojiFile || !emojiName) return;

        setIsUploadingEmoji(true);
        try {
            // 1. Resize and convert to Base64
            const base64Image = await resizeImage(emojiFile);

            // 2. Save to Firestore
            const shortcode = `:${emojiName.toLowerCase().replace(/\s+/g, '_')}:`;

            await addDoc(collection(db, "customEmojis"), {
                name: emojiName,
                shortcode: shortcode,
                url: base64Image, // Storing Base64 directly
                uploaderId: currentUser.uid,
                createdAt: serverTimestamp()
            });

            setEmojiFile(null);
            setEmojiName('');
            setMessage({ type: 'success', text: 'Emoji uploaded successfully!' });
        } catch (error) {
            console.error("Error uploading emoji:", error);
            setMessage({ type: 'error', text: 'Failed to upload emoji.' });
        } finally {
            setIsUploadingEmoji(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

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
            setUsername(currentUser.username || '');
            setCurrentUsername(currentUser.username || '');
            setBio(currentUser.bio || '');
            setBannerURL(currentUser.bannerURL || '');
            setProfileTheme(currentUser.profileTheme || '');
            setProfileAccent(currentUser.profileAccent || '');
            setCustomStatus(currentUser.customStatus || '');
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
        { id: 'emojis', label: 'Custom Emojis', icon: Smile },
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
            const db = getFirestore();

            // Username Uniqueness Check
            if (username !== currentUsername) {
                const usernameRef = doc(db, "usernames", username.toLowerCase());
                const usernameSnap = await getDoc(usernameRef);

                if (usernameSnap.exists()) {
                    setMessage({ type: 'error', text: 'Username is already taken' });
                    setIsLoading(false);
                    return;
                }

                // Reserve new username
                await setDoc(usernameRef, { uid: user.uid });

                // Release old username if it existed
                if (currentUsername) {
                    await deleteDoc(doc(db, "usernames", currentUsername.toLowerCase()));
                }
            }

            await updateProfile(user, {
                displayName: displayName,
                photoURL: photoURL
            });

            // Update Firestore user document
            await setDoc(doc(db, 'users', user.uid), {
                displayName: displayName,
                photoURL: photoURL,
                username: username,
                bio: bio,
                bannerURL: bannerURL,
                profileTheme: profileTheme,
                profileAccent: profileAccent,
                customStatus: customStatus,
                email: user.email,
                lastSeen: new Date()
            }, { merge: true });

            setCurrentUsername(username);
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

                                            {/* User Status */}
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
                                                    Online Status
                                                </label>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                                    gap: '10px'
                                                }}>
                                                    {[
                                                        { id: 'online', label: 'Online', color: '#22c55e' },
                                                        { id: 'idle', label: 'Idle', color: '#eab308' },
                                                        { id: 'dnd', label: 'Do Not Disturb', color: '#ef4444' },
                                                        { id: 'invisible', label: 'Invisible', color: '#6b7280' }
                                                    ].map(status => (
                                                        <button
                                                            key={status.id}
                                                            onClick={() => updateUserStatus(status.id)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                padding: '10px',
                                                                backgroundColor: currentUser?.status === status.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                                                border: currentUser?.status === status.id ? `1px solid ${status.color}` : '1px solid var(--glass-border)',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                color: 'white',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '10px',
                                                                height: '10px',
                                                                borderRadius: '50%',
                                                                backgroundColor: status.color,
                                                                boxShadow: `0 0 8px ${status.color}`
                                                            }} />
                                                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{status.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Sound Settings */}
                                            <div style={{ marginBottom: '24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div>
                                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                                                            Mute All Sounds
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            Disable all ringtones and notification sounds
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={toggleMute}
                                                        style={{
                                                            width: '44px',
                                                            height: '24px',
                                                            backgroundColor: isMuted ? 'var(--success)' : 'var(--bg-tertiary)',
                                                            borderRadius: '12px',
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            backgroundColor: 'white',
                                                            borderRadius: '50%',
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: isMuted ? '22px' : '2px',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                            transition: 'left 0.2s'
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Custom Status */}
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
                                                    Custom Status
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type="text"
                                                        value={customStatus}
                                                        onChange={(e) => setCustomStatus(e.target.value)}
                                                        placeholder="What's happening? (e.g., 🎵 Listening to music)"
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

                                            {/* Username */}
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
                                                    Username (Unique)
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{
                                                        position: 'absolute',
                                                        left: '16px',
                                                        top: '14px',
                                                        color: 'var(--text-muted)',
                                                        fontSize: '15px'
                                                    }}>@</span>
                                                    <input
                                                        type="text"
                                                        value={username}
                                                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                                        placeholder="username"
                                                        style={{
                                                            width: '100%',
                                                            padding: '14px 16px 14px 32px',
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
                                            </div>

                                            {/* Bio */}
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
                                                    About Me
                                                </label>
                                                <textarea
                                                    value={bio}
                                                    onChange={(e) => setBio(e.target.value)}
                                                    placeholder="Tell us about yourself..."
                                                    rows={3}
                                                    style={{
                                                        width: '100%',
                                                        padding: '14px 16px',
                                                        backgroundColor: 'var(--bg-primary)',
                                                        border: '2px solid var(--glass-border)',
                                                        borderRadius: '12px',
                                                        color: 'white',
                                                        fontSize: '15px',
                                                        outline: 'none',
                                                        transition: 'all 0.2s',
                                                        resize: 'none',
                                                        fontFamily: 'inherit'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                                                />
                                            </div>

                                            {/* Banner URL */}
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
                                                    Banner URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bannerURL}
                                                    onChange={(e) => setBannerURL(e.target.value)}
                                                    placeholder="https://example.com/banner.png"
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
                                            <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 600 }}>Profile Customization</h2>

                                            <div style={{ marginBottom: '32px' }}>
                                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                                                    Profile Theme
                                                </h3>
                                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                                    <div>
                                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                            Background Color
                                                        </label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <input
                                                                type="color"
                                                                value={profileTheme || '#1a1b1e'}
                                                                onChange={(e) => setProfileTheme(e.target.value)}
                                                                style={{
                                                                    width: '50px',
                                                                    height: '50px',
                                                                    padding: '0',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: 'transparent'
                                                                }}
                                                            />
                                                            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                                                {profileTheme || '#1a1b1e'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                            Accent Color
                                                        </label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <input
                                                                type="color"
                                                                value={profileAccent || '#7289da'}
                                                                onChange={(e) => setProfileAccent(e.target.value)}
                                                                style={{
                                                                    width: '50px',
                                                                    height: '50px',
                                                                    padding: '0',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: 'transparent'
                                                                }}
                                                            />
                                                            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                                                {profileAccent || '#7289da'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Preview */}
                                                <div style={{ marginTop: '32px' }}>
                                                    <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                        Preview
                                                    </label>
                                                    <div style={{
                                                        width: '300px',
                                                        borderRadius: '12px',
                                                        overflow: 'hidden',
                                                        backgroundColor: profileTheme || '#1a1b1e',
                                                        border: '1px solid var(--glass-border)',
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                                                    }}>
                                                        <div style={{ height: '60px', backgroundColor: profileAccent || '#7289da', opacity: 0.3 }}></div>
                                                        <div style={{ padding: '16px', position: 'relative' }}>
                                                            <div style={{
                                                                width: '64px',
                                                                height: '64px',
                                                                borderRadius: '50%',
                                                                backgroundColor: 'var(--bg-secondary)',
                                                                border: `4px solid ${profileTheme || '#1a1b1e'}`,
                                                                position: 'absolute',
                                                                top: '-32px',
                                                                left: '16px',
                                                                backgroundImage: `url(${photoURL || userAvatar})`,
                                                                backgroundSize: 'cover'
                                                            }}></div>
                                                            <div style={{ marginTop: '36px' }}>
                                                                <div style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                                                                    {displayName}
                                                                </div>
                                                                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                                                                    @{displayName?.toLowerCase().replace(/\s/g, '')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={handleSave}
                                                        disabled={isLoading}
                                                        style={{
                                                            padding: '10px 24px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: 'var(--accent)',
                                                            color: 'white',
                                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            opacity: isLoading ? 0.7 : 1
                                                        }}
                                                    >
                                                        {isLoading ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                                        Save Theme
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ height: '1px', backgroundColor: 'var(--glass-border)', margin: '32px 0' }}></div>

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

                                    {activeTab === 'emojis' && (
                                        <motion.div
                                            key="emojis"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <h3 style={{ margin: '0 0 20px', color: 'white', fontSize: '18px' }}>
                                                Custom Emojis
                                            </h3>

                                            {/* Upload Section */}
                                            {/* Upload Section */}
                                            <div style={{
                                                padding: '24px',
                                                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                                                borderRadius: '16px',
                                                border: '1px solid var(--glass-border)',
                                                marginBottom: '32px',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                                    <div style={{
                                                        width: '40px', height: '40px', borderRadius: '10px',
                                                        background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Plus size={20} color="white" />
                                                    </div>
                                                    <div>
                                                        <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'white', margin: 0 }}>Upload New Emoji</h4>
                                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Add your own flavor to the chat</p>
                                                    </div>
                                                </div>

                                                <form onSubmit={handleEmojiUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                                Emoji Name
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. party_blob"
                                                                value={emojiName}
                                                                onChange={(e) => setEmojiName(e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '12px 16px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid var(--glass-border)',
                                                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                                                    color: 'white',
                                                                    fontSize: '14px',
                                                                    outline: 'none',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                                                onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                                Image File
                                                            </label>
                                                            <div style={{ position: 'relative' }}>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    id="emoji-file"
                                                                    onChange={(e) => setEmojiFile(e.target.files[0])}
                                                                    style={{ display: 'none' }}
                                                                />
                                                                <label
                                                                    htmlFor="emoji-file"
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: '8px',
                                                                        width: '100%',
                                                                        padding: '12px 16px',
                                                                        borderRadius: '12px',
                                                                        border: '1px dashed var(--glass-border)',
                                                                        backgroundColor: emojiFile ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.2)',
                                                                        color: emojiFile ? '#22c55e' : 'var(--text-muted)',
                                                                        fontSize: '14px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                                                                >
                                                                    {emojiFile ? (
                                                                        <>
                                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                {emojiFile.name}
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Camera size={16} />
                                                                            <span>Choose Image</span>
                                                                        </>
                                                                    )}
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="submit"
                                                        disabled={!emojiFile || !emojiName || isUploadingEmoji}
                                                        className="glossy-button"
                                                        style={{
                                                            alignSelf: 'flex-end',
                                                            padding: '12px 24px',
                                                            background: (!emojiFile || !emojiName) ? 'var(--bg-tertiary)' : 'var(--accent-gradient)',
                                                            opacity: (!emojiFile || !emojiName) ? 0.5 : 1,
                                                            cursor: (!emojiFile || !emojiName) ? 'not-allowed' : 'pointer',
                                                            width: '100%',
                                                            marginTop: '8px'
                                                        }}
                                                    >
                                                        {isUploadingEmoji ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                <Loader size={18} className="animate-spin" />
                                                                <span>Uploading...</span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                <Plus size={18} />
                                                                <span>Add to Library</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                </form>
                                            </div>

                                            <div style={{
                                                padding: '24px',
                                                background: 'var(--bg-primary)',
                                                borderRadius: '16px',
                                                border: '1px solid var(--glass-border)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'white', margin: 0 }}>Library</h4>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '12px' }}>
                                                        {Object.keys(customEmojis).length} Emojis
                                                    </span>
                                                </div>

                                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5' }}>
                                                    These emojis are available for everyone. Click to copy the shortcode.
                                                </p>

                                                {Object.keys(customEmojis).length === 0 ? (
                                                    <div style={{
                                                        textAlign: 'center', padding: '40px 20px',
                                                        background: 'var(--bg-tertiary)', borderRadius: '12px',
                                                        border: '1px dashed var(--glass-border)'
                                                    }}>
                                                        <Smile size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No custom emojis yet</div>
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>Be the first to upload one!</div>
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                                        gap: '12px'
                                                    }}>
                                                        {Object.entries(customEmojis).map(([shortcode, url]) => (
                                                            <motion.button
                                                                key={shortcode}
                                                                whileHover={{ scale: 1.02, borderColor: 'var(--accent)' }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(shortcode);
                                                                    // Optional: Show toast
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'center',
                                                                    gap: '12px',
                                                                    padding: '16px',
                                                                    backgroundColor: 'var(--bg-tertiary)',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid var(--glass-border)',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    position: 'relative',
                                                                    overflow: 'hidden'
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: '100%', aspectRatio: '1', display: 'flex',
                                                                    alignItems: 'center', justifyContent: 'center',
                                                                    background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    <img
                                                                        src={url}
                                                                        alt={shortcode}
                                                                        style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                                                                    />
                                                                </div>
                                                                <code style={{
                                                                    fontSize: '11px', color: 'var(--text-secondary)',
                                                                    background: 'rgba(0,0,0,0.3)', padding: '4px 8px',
                                                                    borderRadius: '4px', width: '100%', textAlign: 'center',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                                }}>
                                                                    {shortcode}
                                                                </code>
                                                            </motion.button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                        </motion.div>
                                    )}

                                    {activeTab === 'privacy' && (
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
                        </div >

                        {/* Status Message */}
                        < AnimatePresence >
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
                        </AnimatePresence >
                    </motion.div >
                </motion.div >
            )}
        </AnimatePresence >,
        document.body
    );
}
