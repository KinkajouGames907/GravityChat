import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Hash, Users, LogIn } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function ServerBrowser({ isOpen, onClose, onJoinServer }) {
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
                    width: '100%',
                    maxWidth: '800px',
                    height: '80vh',
                    maxHeight: '600px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Discover Servers</h2>
                    <button onClick={onClose} className="icon-btn"><X size={24} /></button>
                </div>

                {/* Search & Invite Code */}
                <div style={{
                    padding: '24px',
                    display: 'flex',
                    gap: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    flexDirection: 'column' // Stack on mobile if needed, or use media query logic if possible. For now, column is safe or row with wrap.
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

                        <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '8px' }}>
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
                                    width: '120px',
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
                    padding: '24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '16px',
                    alignContent: 'start'
                }}>
                    {servers.map(server => (
                        <div key={server.id} style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid var(--glass-border)',
                            transition: 'transform 0.2s',
                            cursor: 'pointer'
                        }}
                            className="hover:scale-[1.02]"
                        >
                            <div style={{
                                height: '100px',
                                backgroundColor: 'var(--accent)',
                                backgroundImage: server.icon ? `url(${server.icon})` : 'linear-gradient(45deg, var(--accent), #8b5cf6)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }} />

                            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{server.name}</h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', flex: 1 }}>
                                    {server.description || "A community server."}
                                </div>

                                <button
                                    onClick={() => handleJoin(server)}
                                    className="glossy-button"
                                    style={{ width: '100%', justifyContent: 'center' }}
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
