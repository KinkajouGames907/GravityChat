import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Shield, Crown } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import userAvatar from '../assets/user_avatar.png';

export default function UserProfileModal({ isOpen, onClose, user, isMobile }) {
    const [fullProfile, setFullProfile] = useState(user);

    useEffect(() => {
        if (isOpen && user?.uid) {
            setFullProfile(user); // Start with passed data
            const fetchProfile = async () => {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setFullProfile(prev => ({ ...prev, ...userDoc.data() }));
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                }
            };
            fetchProfile();
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown';
        // Handle Firestore timestamp or Date object
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Use fullProfile for rendering, fallback to user prop if needed
    const displayUser = fullProfile || user;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 3000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isMobile ? '0' : '20px'
                }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            width: isMobile ? '100%' : '600px',
                            maxWidth: '100%',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: isMobile ? '0' : '16px',
                            border: isMobile ? 'none' : '1px solid var(--glass-border)',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {/* Banner */}
                        <div style={{
                            height: '200px',
                            backgroundColor: displayUser.bannerURL ? 'transparent' : 'var(--accent)',
                            backgroundImage: displayUser.bannerURL ? `url(${displayUser.bannerURL})` : 'linear-gradient(45deg, var(--accent), #a855f7)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            position: 'relative'
                        }}>
                            <button
                                onClick={onClose}
                                style={{
                                    position: 'absolute',
                                    top: '16px',
                                    right: '16px',
                                    background: 'rgba(0,0,0,0.5)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Profile Info */}
                        <div style={{ padding: '0 24px 24px', position: 'relative' }}>
                            {/* Avatar */}
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                border: '6px solid var(--bg-secondary)',
                                backgroundColor: 'var(--bg-tertiary)',
                                backgroundImage: `url(${displayUser.photoURL || userAvatar})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                marginTop: '-60px',
                                marginBottom: '16px'
                            }} />

                            {/* Names */}
                            <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'white' }}>
                                    {displayUser.displayName}
                                </h2>
                                <div style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                                    @{displayUser.username || displayUser.email?.split('@')[0] || 'unknown'}
                                </div>
                            </div>

                            {/* Bio */}
                            {displayUser.bio && (
                                <div style={{
                                    marginBottom: '24px',
                                    padding: '16px',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <h4 style={{ margin: '0 0 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>About Me</h4>
                                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                        {displayUser.bio}
                                    </p>
                                </div>
                            )}

                            {/* Badges / Roles */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                {displayUser.isOwner && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 10px', borderRadius: '20px',
                                        backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24',
                                        fontSize: '12px', fontWeight: 600, border: '1px solid rgba(251, 191, 36, 0.2)'
                                    }}>
                                        <Crown size={14} /> Server Owner
                                    </div>
                                )}
                                {displayUser.isMod && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 10px', borderRadius: '20px',
                                        backgroundColor: 'rgba(29, 155, 240, 0.1)', color: 'var(--accent)',
                                        fontSize: '12px', fontWeight: 600, border: '1px solid rgba(29, 155, 240, 0.2)'
                                    }}>
                                        <Shield size={14} /> Moderator
                                    </div>
                                )}
                            </div>

                            {/* Meta */}
                            <div style={{
                                borderTop: '1px solid var(--glass-border)',
                                paddingTop: '16px',
                                display: 'flex',
                                gap: '24px',
                                color: 'var(--text-muted)',
                                fontSize: '13px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={16} />
                                    Joined {formatDate(displayUser.createdAt || displayUser.metadata?.creationTime)}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
