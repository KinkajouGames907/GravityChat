import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function CreateServerModal({ isOpen, onClose }) {
    const [serverName, setServerName] = useState('');
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!serverName.trim()) return;

        setLoading(true);
        try {
            // 1. Create Server Doc
            const serverRef = await addDoc(collection(db, "servers"), {
                name: serverName,
                ownerId: currentUser.uid,
                createdAt: serverTimestamp(),
                icon: null,
                inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                channels: [
                    { name: 'general', type: 'text' },
                    { name: 'announcements', type: 'text' },
                    { name: 'lounge', type: 'voice' }
                ],
                roles: [
                    {
                        id: 'admin',
                        name: 'Admin',
                        color: '#ff0000',
                        permissions: ['ADMIN', 'MANAGE_SERVER', 'MANAGE_ROLES', 'MANAGE_CHANNELS', 'KICK_MEMBERS', 'BAN_MEMBERS']
                    },
                    {
                        id: 'member',
                        name: 'Member',
                        color: '#99aab5',
                        permissions: []
                    }
                ]
            });

            // 2. Add Owner as Member
            await setDoc(doc(db, "servers", serverRef.id, "members", currentUser.uid), {
                joinedAt: serverTimestamp(),
                roles: ['admin']
            });

            // 3. Add to User's joinedServers
            await updateDoc(doc(db, "users", currentUser.uid), {
                joinedServers: arrayUnion(serverRef.id)
            });

            onClose();
            setServerName('');
        } catch (error) {
            console.error("Error creating server:", error);
            alert("Failed to create server. Check console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 50,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-40%' }}
                        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-40%' }}
                        className="glass-panel"
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            // transform is handled by framer-motion
                            width: '100%',
                            maxWidth: '440px',
                            padding: '24px',
                            borderRadius: '16px',
                            zIndex: 51,
                            background: '#1e1f22' // Discord-like dark modal bg
                        }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>Customize Your Server</h2>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                Give your new server a personality with a name and an icon. You can always change it later.
                            </p>
                        </div>

                        <form onSubmit={handleCreate}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    border: '2px dashed var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    <Upload size={24} color="var(--text-muted)" />
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>UPLOAD</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: 'var(--text-secondary)',
                                    marginBottom: '8px',
                                    textTransform: 'uppercase'
                                }}>
                                    Server Name
                                </label>
                                <input
                                    type="text"
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}
                                    placeholder={`${currentUser?.displayName || 'User'}'s Server`}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: '#111214',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        fontSize: '16px'
                                    }}
                                    autoFocus
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#2b2d31',
                                margin: '0 -24px -24px',
                                padding: '16px 24px',
                                borderRadius: '0 0 16px 16px'
                            }}>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="glossy-button"
                                    disabled={loading}
                                    style={{ padding: '10px 24px', width: 'auto' }}
                                >
                                    {loading ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>

                        <button
                            onClick={onClose}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={24} />
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
