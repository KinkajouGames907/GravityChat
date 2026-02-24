import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Server, Sparkles, Loader } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { INVITE_CODE_LENGTH } from '../utils/constants';

function generateSecureInviteCode(length = INVITE_CODE_LENGTH) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, v => chars[v % chars.length]).join('');
}

const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(6,4,15,0.8)',
    border: '1px solid rgba(168,85,247,0.18)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
};

const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '7px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
};

export default function CreateServerModal({ isOpen, onClose }) {
    const [serverName, setServerName] = useState('');
    const [serverDescription, setServerDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();
    const { canJoinServer, tier, openSubscriptionModal } = useSubscription();

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!serverName.trim()) return;

        // Check tier server limit before creating
        const serverCount = (currentUser.joinedServers || []).length;
        if (!canJoinServer(serverCount)) {
            onClose();
            openSubscriptionModal();
            return;
        }

        setLoading(true);
        let serverRef = null;
        try {
            serverRef = await addDoc(collection(db, 'servers'), {
                name: serverName.trim(),
                description: serverDescription.trim(),
                ownerId: currentUser.uid,
                createdAt: serverTimestamp(),
                icon: null,
                inviteCode: generateSecureInviteCode(),
                channels: [
                    { name: 'general', type: 'text', category: 'Text Channels' },
                    { name: 'announcements', type: 'text', category: 'Text Channels' },
                    { name: 'lounge', type: 'voice', category: 'Voice Channels' }
                ],
                categories: ['Text Channels', 'Voice Channels'],
                roles: [
                    {
                        id: 'admin',
                        name: 'Admin',
                        color: '#a855f7',
                        permissions: ['ADMIN', 'MANAGE_SERVER', 'MANAGE_ROLES', 'MANAGE_CHANNELS', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_MESSAGES', 'PIN_MESSAGES']
                    },
                    {
                        id: 'moderator',
                        name: 'Moderator',
                        color: '#ec4899',
                        permissions: ['KICK_MEMBERS', 'MANAGE_MESSAGES', 'PIN_MESSAGES']
                    },
                    {
                        id: 'member',
                        name: 'Member',
                        color: '#b0a0cc',
                        permissions: []
                    }
                ],
                bannedUsers: [],
                memberCount: 1
            });

            await setDoc(doc(db, 'servers', serverRef.id, 'members', currentUser.uid), {
                joinedAt: serverTimestamp(),
                roles: ['admin']
            });

            await updateDoc(doc(db, 'users', currentUser.uid), {
                joinedServers: arrayUnion(serverRef.id)
            });

            onClose();
            setServerName('');
            setServerDescription('');
        } catch (error) {
            if (serverRef) {
                try { await deleteDoc(doc(db, 'servers', serverRef.id)); } catch (_) {}
            }
            if (import.meta.env.DEV) console.error('Error creating server:', error);
            alert('Failed to create server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="create-server-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={handleClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2,1,8,0.85)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 3000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <motion.div
                        key="create-server-modal"
                        initial={{ opacity: 0, scale: 0.82, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 20 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '460px',
                            borderRadius: '20px',
                            background: 'linear-gradient(160deg, rgba(19,13,34,0.99) 0%, rgba(9,6,20,0.99) 100%)',
                            border: '1px solid rgba(168,85,247,0.25)',
                            boxShadow: '0 0 80px rgba(168,85,247,0.15), 0 30px 80px rgba(0,0,0,0.7)',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        {/* Top gradient glow strip */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, #a855f7, #ec4899, transparent)',
                        }} />

                        {/* Ambient nebula glow */}
                        <div style={{
                            position: 'absolute',
                            top: '-40px', right: '-40px',
                            width: '180px', height: '180px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
                            pointerEvents: 'none',
                        }} />

                        {/* Close button */}
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            onClick={handleClose}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'rgba(168,85,247,0.1)',
                                border: '1px solid rgba(168,85,247,0.15)',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                            }}
                        >
                            <X size={16} />
                        </motion.button>

                        {/* Header */}
                        <div style={{ padding: '32px 28px 0', textAlign: 'center' }}>
                            <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '18px',
                                    background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(236,72,153,0.2))',
                                    border: '1px solid rgba(168,85,247,0.3)',
                                    marginBottom: '16px',
                                    boxShadow: '0 8px 32px rgba(168,85,247,0.2)',
                                }}
                            >
                                <Server size={28} color="#c084fc" />
                            </motion.div>

                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.12, duration: 0.4 }}
                                style={{
                                    fontSize: '22px',
                                    fontWeight: 800,
                                    margin: '0 0 8px 0',
                                    fontFamily: 'Space Grotesk, sans-serif',
                                    background: 'linear-gradient(135deg, #ede8ff, #c084fc)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                Create Your Server
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.18, duration: 0.4 }}
                                style={{
                                    color: 'var(--text-secondary)',
                                    margin: '0 0 24px 0',
                                    fontSize: '14px',
                                    lineHeight: 1.5,
                                }}
                            >
                                Give your server a name and an icon. You can always change these later.
                            </motion.p>
                        </div>

                        {/* Upload Icon Area */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.22, type: 'spring', stiffness: 300, damping: 22 }}
                            style={{ display: 'flex', justifyContent: 'center', padding: '0 28px 20px' }}
                        >
                            <motion.div
                                whileHover={{ scale: 1.06, borderColor: 'rgba(168,85,247,0.6)' }}
                                whileTap={{ scale: 0.96 }}
                                style={{
                                    width: '88px',
                                    height: '88px',
                                    borderRadius: '50%',
                                    border: '2px dashed rgba(168,85,247,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    background: 'rgba(168,85,247,0.05)',
                                    transition: 'border-color 0.2s',
                                }}
                            >
                                <Upload size={22} color="rgba(168,85,247,0.5)" />
                                <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(168,85,247,0.5)', letterSpacing: '0.1em' }}>UPLOAD</span>
                            </motion.div>
                        </motion.div>

                        {/* Form */}
                        <form onSubmit={handleCreate} style={{ padding: '0 28px' }}>
                            <motion.div
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.26, duration: 0.4 }}
                                style={{ marginBottom: '16px' }}
                            >
                                <label style={labelStyle}>Server Name</label>
                                <input
                                    type="text"
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value.slice(0, 100))}
                                    placeholder={`${currentUser?.displayName || 'User'}'s Server`}
                                    style={inputStyle}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'rgba(168,85,247,0.6)';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(168,85,247,0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(168,85,247,0.18)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                    autoFocus
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.32, duration: 0.4 }}
                                style={{ marginBottom: '24px' }}
                            >
                                <label style={labelStyle}>Description (Optional)</label>
                                <textarea
                                    value={serverDescription}
                                    onChange={(e) => setServerDescription(e.target.value.slice(0, 500))}
                                    placeholder="What's your server about?"
                                    rows={3}
                                    style={{
                                        ...inputStyle,
                                        resize: 'none',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'rgba(168,85,247,0.6)';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(168,85,247,0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(168,85,247,0.18)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', textAlign: 'right' }}>
                                    {serverDescription.length}/500
                                </div>
                            </motion.div>

                            {/* Footer */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.38, duration: 0.4 }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(168,85,247,0.04)',
                                    margin: '0 -28px',
                                    padding: '18px 28px',
                                    borderTop: '1px solid rgba(168,85,247,0.1)',
                                }}
                            >
                                <motion.button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={loading}
                                    whileHover={{ color: 'var(--text-primary)' }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        padding: '0',
                                        transition: 'color 0.2s',
                                    }}
                                >
                                    Back
                                </motion.button>

                                <motion.button
                                    type="submit"
                                    disabled={loading || !serverName.trim()}
                                    whileHover={!loading && serverName.trim() ? { scale: 1.03, boxShadow: '0 6px 24px rgba(168,85,247,0.5)' } : {}}
                                    whileTap={!loading && serverName.trim() ? { scale: 0.97 } : {}}
                                    style={{
                                        background: serverName.trim()
                                            ? 'linear-gradient(135deg, #a855f7, #ec4899)'
                                            : 'rgba(168,85,247,0.2)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '10px 28px',
                                        color: serverName.trim() ? 'white' : 'rgba(255,255,255,0.4)',
                                        fontWeight: 700,
                                        fontSize: '15px',
                                        cursor: serverName.trim() ? 'pointer' : 'not-allowed',
                                        fontFamily: 'inherit',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'background 0.2s',
                                        boxShadow: serverName.trim() ? '0 4px 16px rgba(168,85,247,0.35)' : 'none',
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader size={16} className="animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} />
                                            Create Server
                                        </>
                                    )}
                                </motion.button>
                            </motion.div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
