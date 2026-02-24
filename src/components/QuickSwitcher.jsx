import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Hash, Volume2, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import userAvatar from '../assets/user_avatar.png';
import { resolveAvatarUrl } from '../utils/avatarUrl';

export default function QuickSwitcher({ isOpen, onClose, onNavigate }) {
    const { currentUser } = useAuth();
    const [searchText, setSearchText] = useState('');
    const [items, setItems] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    // Fetch all navigable items when opened
    useEffect(() => {
        if (!isOpen || !currentUser) return;
        setLoading(true);
        setSearchText('');
        setSelectedIndex(0);

        const fetchItems = async () => {
            const allItems = [];

            // Fetch servers + channels
            const joinedServers = currentUser.joinedServers || [];
            await Promise.all(joinedServers.map(async (serverId) => {
                try {
                    const serverSnap = await getDoc(doc(db, 'servers', serverId));
                    if (!serverSnap.exists()) return;
                    const sd = serverSnap.data();
                    (sd.channels || []).forEach(ch => {
                        allItems.push({
                            type: 'channel',
                            label: ch.name,
                            sublabel: sd.name,
                            serverId,
                            channelId: `${serverId}-${ch.name}`,
                            channelName: ch.name,
                            channelType: ch.type,
                        });
                    });
                } catch (_) {}
            }));

            // Fetch DMs
            try {
                const dmSnap = await getDocs(
                    query(collection(db, 'dms'), where('participants', 'array-contains', currentUser.uid))
                );
                await Promise.all(dmSnap.docs.map(async (dmDoc) => {
                    const data = dmDoc.data();
                    const participants = Array.isArray(data.participants) ? data.participants : [];

                    if (data.isGroup) {
                        const otherIds = participants.filter((uid) => uid !== currentUser.uid);
                        const names = await Promise.all(otherIds.map(async (uid) => {
                            try {
                                const userDoc = await getDoc(doc(db, 'users', uid));
                                if (!userDoc.exists()) return null;
                                return userDoc.data().displayName || null;
                            } catch (_) {
                                return null;
                            }
                        }));
                        const fallbackName = names.filter(Boolean).slice(0, 3).join(', ') || 'Group Chat';
                        const label = data.name?.trim() || fallbackName;

                        allItems.push({
                            type: 'group-dm',
                            label,
                            sublabel: `${participants.length || 0} members`,
                            serverId: 'home',
                            channelId: dmDoc.id,
                            channelName: label,
                            channelType: 'group-dm',
                            photoURL: data.photoURL || '',
                            dmUser: null,
                        });
                        return;
                    }

                    const otherId = participants.find((uid) => uid !== currentUser.uid);
                    if (!otherId) return;

                    try {
                        const userDoc = await getDoc(doc(db, 'users', otherId));
                        if (userDoc.exists()) {
                            const ud = userDoc.data();
                            allItems.push({
                                type: 'dm',
                                label: ud.displayName || 'Unknown',
                                sublabel: 'Direct Message',
                                serverId: 'home',
                                channelId: dmDoc.id,
                                channelName: ud.displayName || 'Unknown',
                                channelType: 'dm',
                                photoURL: ud.photoURL,
                                dmUser: { uid: otherId, ...ud },
                            });
                        }
                    } catch (_) { }
                }));
            } catch (_) {}

            setItems(allItems);
            setLoading(false);
        };

        fetchItems();
    }, [isOpen, currentUser]);

    // Auto-focus input
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 60);
    }, [isOpen]);

    const filtered = (() => {
        const q = searchText.toLowerCase();
        if (!q) return items.slice(0, 20);
        return items
            .filter(item =>
                item.label.toLowerCase().includes(q) ||
                item.sublabel?.toLowerCase().includes(q)
            )
            .slice(0, 20);
    })();

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[selectedIndex]) { onNavigate(filtered[selectedIndex]); onClose(); }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, selectedIndex, filtered, onNavigate, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(2,1,8,0.75)',
                backdropFilter: 'blur(10px)',
                zIndex: 5000,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                padding: '12vh 16px 0',
            }}
        >
            <motion.div
                initial={{ scale: 0.88, y: -24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.88, y: -16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30, mass: 0.65 }}
                style={{
                    width: '100%', maxWidth: '620px',
                    background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                    border: '1px solid rgba(168,85,247,0.3)',
                    borderRadius: '18px', overflow: 'hidden',
                    boxShadow: '0 0 100px rgba(168,85,247,0.25), 0 40px 80px rgba(0,0,0,0.7)',
                    position: 'relative',
                }}
            >
                {/* Top glow strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #a855f7, #ec4899, transparent)' }} />

                {/* Search bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '18px 22px',
                    borderBottom: '1px solid rgba(168,85,247,0.12)',
                }}>
                    <Search size={20} color="rgba(168,85,247,0.7)" style={{ flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Jump to a channel or conversation..."
                        value={searchText}
                        onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(0); }}
                        style={{
                            flex: 1, background: 'transparent', border: 'none',
                            color: 'white', fontSize: '16px', outline: 'none',
                            fontFamily: 'inherit',
                        }}
                    />
                    <kbd style={{
                        fontSize: '11px', color: 'rgba(168,85,247,0.45)', fontFamily: 'monospace',
                        background: 'rgba(168,85,247,0.08)', padding: '2px 7px', borderRadius: '5px',
                        border: '1px solid rgba(168,85,247,0.15)', flexShrink: 0,
                    }}>ESC</kbd>
                </div>

                {/* Results list */}
                <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                            Searching channels...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                            {searchText ? `No results for "${searchText}"` : 'No channels found'}
                        </div>
                    ) : (
                        <>
                            {!searchText && (
                                <div style={{
                                    padding: '8px 22px 4px',
                                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                                    color: 'rgba(168,85,247,0.5)', textTransform: 'uppercase',
                                }}>
                                    Channels & Conversations
                                </div>
                            )}
                            {filtered.map((item, i) => (
                                <motion.div
                                    key={`${item.serverId}-${item.channelId}-${i}`}
                                    whileHover={{ backgroundColor: 'rgba(168,85,247,0.1)' }}
                                    onClick={() => { onNavigate(item); onClose(); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        padding: '10px 22px', cursor: 'pointer',
                                        backgroundColor: i === selectedIndex ? 'rgba(168,85,247,0.14)' : 'transparent',
                                        transition: 'background-color 0.1s',
                                        borderLeft: i === selectedIndex ? '2px solid #a855f7' : '2px solid transparent',
                                    }}
                                >
                                    {/* Icon */}
                                    {(item.type === 'dm' || item.type === 'group-dm') ? (
                                        item.type === 'group-dm' && !resolveAvatarUrl(item.photoURL) ? (
                                            <div style={{
                                                width: '34px',
                                                height: '34px',
                                                borderRadius: '50%',
                                                flexShrink: 0,
                                                border: '1px solid rgba(168,85,247,0.2)',
                                                background: 'rgba(168,85,247,0.12)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Users size={16} color="#a855f7" />
                                            </div>
                                        ) : (
                                            <div style={{
                                                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                                                backgroundImage: `url(${resolveAvatarUrl(item.photoURL) || userAvatar})`,
                                                backgroundSize: 'cover', backgroundPosition: 'center',
                                                border: '1px solid rgba(168,85,247,0.2)',
                                            }} />
                                        )
                                    ) : (
                                        <div style={{
                                            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                                            background: i === selectedIndex ? 'rgba(168,85,247,0.22)' : 'rgba(168,85,247,0.1)',
                                            border: '1px solid rgba(168,85,247,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'background 0.1s',
                                        }}>
                                            {item.channelType === 'voice'
                                                ? <Volume2 size={17} color={i === selectedIndex ? '#c084fc' : '#a855f7'} />
                                                : <Hash size={17} color={i === selectedIndex ? '#c084fc' : '#a855f7'} />
                                            }
                                        </div>
                                    )}

                                    {/* Text */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 600, fontSize: '14px',
                                            color: i === selectedIndex ? '#c084fc' : 'var(--text-primary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {item.type === 'channel' ? `#${item.label}` : item.label}
                                        </div>
                                        <div style={{
                                            fontSize: '12px', color: 'var(--text-muted)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {item.sublabel}
                                        </div>
                                    </div>

                                    {/* Enter hint */}
                                    {i === selectedIndex && (
                                        <motion.span
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            style={{
                                                fontSize: '12px', color: 'rgba(168,85,247,0.6)',
                                                background: 'rgba(168,85,247,0.1)', padding: '2px 8px',
                                                borderRadius: '5px', fontFamily: 'monospace', flexShrink: 0,
                                            }}
                                        >
                                            ↵
                                        </motion.span>
                                    )}
                                </motion.div>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '8px 22px',
                    borderTop: '1px solid rgba(168,85,247,0.1)',
                    display: 'flex', gap: '18px', alignItems: 'center',
                    fontSize: '11px', color: 'rgba(168,85,247,0.4)',
                }}>
                    {[['↑↓', 'Navigate'], ['↵', 'Open'], ['Esc', 'Close']].map(([key, label]) => (
                        <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <kbd style={{ fontFamily: 'monospace', background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(168,85,247,0.15)' }}>{key}</kbd>
                            {label}
                        </span>
                    ))}
                    <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
                        <kbd style={{ fontFamily: 'monospace', background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(168,85,247,0.15)', marginRight: '4px' }}>Ctrl+K</kbd>
                        Quick Switcher
                    </span>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
}
