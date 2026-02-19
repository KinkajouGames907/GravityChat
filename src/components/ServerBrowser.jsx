import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Hash, Users, LogIn } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function ServerBrowser({ isOpen, onClose, onJoinServer, isMobile }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (isOpen) {
            fetchServers();
        }
    }, [isOpen]);

    const fetchServers = async () => {
        setLoading(true);
        try {
            // In a real app, we'd paginate or use Algolia. For now, fetch all (capped) or search.
            // If search term is empty, just fetch recent 20.
            let q = query(collection(db, "servers"));

            // Client-side filtering for search because Firestore simple queries are limited
            const snapshot = await getDocs(q);
            let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (searchTerm) {
                results = results.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
            }

            setServers(results);
        } catch (error) {
            console.error("Error fetching servers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (server) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Add to server members subcollection
            await setDoc(doc(db, "servers", server.id, "members", currentUser.uid), {
                joinedAt: serverTimestamp(),
                roles: [] // Default member
            });

            // 2. Add to user's joinedServers
            await updateDoc(doc(db, "users", currentUser.uid), {
                joinedServers: arrayUnion(server.id)
            });

            onJoinServer(server.id);
            onClose();
        } catch (error) {
            console.error("Error joining server:", error);
            alert("Failed to join server.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinByCode = async (e) => {
        e.preventDefault();
        if (!inviteCode) return;
        setLoading(true);
        try {
            const q = query(collection(db, "servers"), where("inviteCode", "==", inviteCode.trim().toUpperCase()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert("Invalid invite code");
                setLoading(false);
                return;
            }

            const server = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            await handleJoin(server);
        } catch (error) {
            console.error("Error joining by code:", error);
            alert("Error joining server");
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                    width: isMobile ? '100%' : '100%',
                    maxWidth: isMobile ? '100%' : '800px',
                    height: isMobile ? '100%' : '80vh',
                    maxHeight: isMobile ? 'none' : '600px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: isMobile ? '0' : '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: isMobile ? '16px' : '24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700 }}>Discover Servers</h2>
                    <button onClick={onClose} className="icon-btn"><X size={24} /></button>
                </div>

                {/* Search & Invite Code */}
                <div style={{
                    padding: isMobile ? '16px' : '24px',
                    display: 'flex',
                    gap: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    flexDirection: isMobile ? 'column' : 'row',
                    flexShrink: 0
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{
                            flex: 1,
                            minWidth: '200px',
                            position: 'relative'
                        }}>
                            <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search for a server..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    // Debounce fetch in real app
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && fetchServers()}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 40px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    color: 'white',
                                    fontSize: '16px'
                                }}
                            />
                        </div>

                        <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                            <input
                                type="text"
                                placeholder="Invite Code"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    color: 'white',
                                    width: isMobile ? '100%' : '120px',
                                    textAlign: 'center',
                                    textTransform: 'uppercase'
                                }}
                            />
                            <button
                                type="submit"
                                className="glossy-button"
                                disabled={loading || !inviteCode}
                            >
                                Join
                            </button>
                        </form>
                    </div>
                </div>

                {/* Server List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: isMobile ? '16px' : '24px',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '16px',
                    alignContent: 'start'
                }}>
                    {servers.map(server => (
                        <div key={server.id} style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column', // Always column for better layout
                            border: '1px solid var(--glass-border)',
                            transition: 'transform 0.2s',
                            minHeight: '280px',
                            position: 'relative'
                        }}
                            className="hover:scale-[1.02]"
                        >
                            <div style={{
                                height: '120px',
                                width: '100%',
                                backgroundColor: 'var(--accent)',
                                backgroundImage: server.icon ? `url(${server.icon})` : 'linear-gradient(45deg, var(--accent), #8b5cf6)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                flexShrink: 0
                            }} />

                            <div style={{
                                padding: '16px',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between' // Push button to bottom
                            }}>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'white' }}>{server.name}</h3>
                                    <div style={{
                                        fontSize: '13px',
                                        color: 'var(--text-muted)',
                                        marginBottom: '16px',
                                        display: '-webkit-box',
                                        WebkitLineClamp: isMobile ? 2 : 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {server.description || "A community server."}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleJoin(server);
                                    }}
                                    className="glossy-button"
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        padding: '10px 16px',
                                        fontSize: '14px',
                                        marginTop: 'auto',
                                        backgroundColor: 'var(--accent)',
                                        cursor: 'pointer'
                                    }}
                                    disabled={loading}
                                >
                                    Join Server
                                </button>
                            </div>
                        </div>
                    ))}

                    {servers.length === 0 && !loading && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                            No servers found.
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
