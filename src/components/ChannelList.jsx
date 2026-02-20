import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Volume2, ChevronDown, ChevronRight, Mic, Headphones, Settings, Plus, MessageCircle, X, UserPlus, Trash2, Link, Check, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, where, getDocs, setDoc, getDoc, arrayRemove, orderBy, serverTimestamp } from 'firebase/firestore';
import SettingsModal from './SettingsModal';
import { hasPermission, PERMISSIONS, isServerOwner } from '../utils/permissions';
import userAvatar from '../assets/user_avatar.png';

const STATUS_OPTIONS = [
    { key: 'online',    label: 'Online',          color: '#22c55e', emoji: '🟢' },
    { key: 'idle',      label: 'Idle',             color: '#f59e0b', emoji: '🌙' },
    { key: 'dnd',       label: 'Do Not Disturb',   color: '#ef4444', emoji: '⛔' },
    { key: 'invisible', label: 'Invisible',        color: '#6b7280', emoji: '👻' },
];

const getStatusColor = (status) => {
    const opt = STATUS_OPTIONS.find(o => o.key === status);
    return opt ? opt.color : '#6b7280';
};

/* ── Skeleton ─────────────────────────────────────────────────────────── */
function SkeletonRow({ width = '75%', delay = 0 }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}
            style={{ padding: '6px 16px', marginBottom: '4px' }}>
            <div className="skeleton" style={{ height: '32px', borderRadius: '8px', width }} />
        </motion.div>
    );
}

/* ── Channel item ─────────────────────────────────────────────────────── */
const ChannelItem = ({ name, type, active, onClick, onDelete, canDelete, index, hasUnread }) => (
    <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center',
            padding: '7px 10px', margin: '1px 8px', borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: active ? 'rgba(168,85,247,0.14)' : 'transparent',
            color: active ? '#ede8ff' : 'var(--text-secondary)',
            transition: 'background-color 0.15s, color 0.15s',
            position: 'relative',
            borderLeft: active ? '2px solid #a855f7' : '2px solid transparent',
        }}
        className="channel-item hover:bg-white/5 group"
        whileHover={{ x: active ? 0 : 4 }}
    >
        {type === 'voice'
            ? <Volume2 size={17} style={{ marginRight: '8px', flexShrink: 0, color: active ? '#a855f7' : undefined }} />
            : <Hash size={17} style={{ marginRight: '8px', flexShrink: 0, color: active ? '#a855f7' : undefined }} />
        }
        <span style={{ fontWeight: active || hasUnread ? 600 : 500, fontSize: '14px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: hasUnread && !active ? 'var(--text-primary)' : undefined }}>
            {name}
        </span>
        {hasUnread && !active && (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7', flexShrink: 0, boxShadow: '0 0 6px rgba(168,85,247,0.7)' }} />
        )}
        {canDelete && (
            <motion.button
                initial={{ opacity: 0 }} whileHover={{ opacity: 1, scale: 1.1 }}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                title="Delete Channel"
            >
                <Trash2 size={13} />
            </motion.button>
        )}
    </motion.div>
);

/* ── DM item ──────────────────────────────────────────────────────────── */
const DMItem = ({ user, active, onClick, index }) => (
    <motion.div
        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 10px', margin: '1px 8px', borderRadius: '10px',
            cursor: 'pointer',
            backgroundColor: active ? 'rgba(168,85,247,0.14)' : 'transparent',
            color: active ? '#ede8ff' : 'var(--text-secondary)',
            transition: 'background-color 0.15s',
            position: 'relative',
        }}
        className="liquid-list-item hover:bg-white/5"
        whileHover={{ x: active ? 0 : 3 }}
    >
        <div style={{ position: 'relative', marginRight: '10px', flexShrink: 0 }}>
            <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                backgroundImage: `url(${user.photoURL || userAvatar})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: '1px solid rgba(168,85,247,0.18)',
            }} />
            <div style={{
                position: 'absolute', bottom: '-1px', right: '-1px',
                width: '11px', height: '11px', borderRadius: '50%',
                backgroundColor: getStatusColor(user.status),
                border: '2px solid var(--bg-secondary)',
            }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: active ? 600 : 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName}
            </div>
            {user.statusMessage && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.statusMessage}
                </div>
            )}
        </div>
    </motion.div>
);

/* ── Collapsible section header ───────────────────────────────────────── */
function SectionHeader({ label, collapsed, onToggle, onAdd, canAdd }) {
    return (
        <div
            style={{
                padding: '14px 16px 4px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', userSelect: 'none',
            }}
            onClick={onToggle}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={13} color="var(--text-muted)" />
                </motion.div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                </span>
            </div>
            {canAdd && (
                <motion.button
                    whileHover={{ scale: 1.2, color: '#a855f7' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}
                >
                    <Plus size={14} />
                </motion.button>
            )}
        </div>
    );
}

/* ── Invite modal ─────────────────────────────────────────────────────── */
function InviteModal({ inviteCode, serverName, onClose }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(2,1,8,0.8)',
                backdropFilter: 'blur(8px)',
                zIndex: 3000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
            }}
        >
            <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.85, y: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '440px',
                    background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                    border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: '18px', padding: '28px',
                    boxShadow: '0 0 60px rgba(168,85,247,0.15), 0 30px 60px rgba(0,0,0,0.6)',
                    position: 'relative',
                }}
            >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #a855f7, #ec4899, transparent)', borderRadius: '18px 18px 0 0' }} />

                <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    onClick={onClose}
                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    <X size={15} />
                </motion.button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg,rgba(168,85,247,0.3),rgba(236,72,153,0.2))', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Link size={20} color="#c084fc" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>Invite People</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>to {serverName}</p>
                    </div>
                </div>

                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Server Invite Code
                </p>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                        flex: 1, padding: '12px 16px',
                        background: 'rgba(6,4,15,0.9)',
                        border: '1px solid rgba(168,85,247,0.2)',
                        borderRadius: '10px',
                        fontFamily: 'monospace', fontSize: '20px', fontWeight: 700,
                        letterSpacing: '0.2em', color: '#c084fc',
                        textAlign: 'center',
                    }}>
                        {inviteCode}
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCopy}
                        style={{
                            background: copied ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #a855f7, #ec4899)',
                            border: 'none', borderRadius: '10px',
                            padding: '12px 18px', color: 'white',
                            fontWeight: 700, fontSize: '14px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 14px rgba(168,85,247,0.35)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {copied ? <><Check size={16} /> Copied!</> : <><Link size={16} /> Copy</>}
                    </motion.button>
                </div>

                <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Share this code with friends so they can join your server.
                </p>
            </motion.div>
        </motion.div>
    );
}

/* ── Status picker popup ──────────────────────────────────────────────── */
function StatusPicker({ currentStatus, currentStatusMessage, onSelectStatus, onSetStatusMessage, onClose }) {
    const [editingMsg, setEditingMsg] = useState(false);
    const [msgInput, setMsgInput] = useState(currentStatusMessage || '');

    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'absolute', bottom: '100%', left: '8px',
                marginBottom: '8px', zIndex: 500,
                background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: '14px', padding: '8px',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
                minWidth: '220px',
            }}
        >
            <div style={{ padding: '4px 8px 8px', fontSize: '11px', fontWeight: 700, color: 'rgba(168,85,247,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Set Status
            </div>
            {STATUS_OPTIONS.map(opt => (
                <motion.div
                    key={opt.key}
                    whileHover={{ backgroundColor: 'rgba(168,85,247,0.1)' }}
                    onClick={() => { onSelectStatus(opt.key); onClose(); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 10px', borderRadius: '8px', cursor: 'pointer',
                        backgroundColor: currentStatus === opt.key ? 'rgba(168,85,247,0.15)' : 'transparent',
                        transition: 'background-color 0.1s',
                    }}
                >
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: currentStatus === opt.key ? 700 : 500, color: currentStatus === opt.key ? '#c084fc' : 'var(--text-primary)' }}>
                        {opt.label}
                    </span>
                    {currentStatus === opt.key && <Check size={14} color="#a855f7" style={{ marginLeft: 'auto' }} />}
                </motion.div>
            ))}
            <div style={{ borderTop: '1px solid rgba(168,85,247,0.1)', marginTop: '6px', paddingTop: '8px' }}>
                {editingMsg ? (
                    <div style={{ padding: '4px 6px', display: 'flex', gap: '6px' }}>
                        <input
                            autoFocus
                            type="text"
                            value={msgInput}
                            onChange={(e) => setMsgInput(e.target.value.slice(0, 60))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { onSetStatusMessage(msgInput); onClose(); }
                                if (e.key === 'Escape') setEditingMsg(false);
                            }}
                            placeholder="What's your status?"
                            style={{ flex: 1, padding: '6px 8px', fontSize: '13px', background: 'rgba(6,4,15,0.8)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '6px', color: 'white', fontFamily: 'inherit' }}
                        />
                        <button onClick={() => { onSetStatusMessage(msgInput); onClose(); }}
                            style={{ background: 'linear-gradient(135deg,#a855f7,#ec4899)', border: 'none', borderRadius: '6px', padding: '0 10px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                            Set
                        </button>
                    </div>
                ) : (
                    <motion.div
                        whileHover={{ backgroundColor: 'rgba(168,85,247,0.1)' }}
                        onClick={() => setEditingMsg(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.1s' }}
                    >
                        <span style={{ fontSize: '16px' }}>✏️</span>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Set custom status</div>
                            {currentStatusMessage && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                    {currentStatusMessage}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

/* ── User area ────────────────────────────────────────────────────────── */
function UserArea({ currentUser, userRoleColor, onSettings }) {
    const { updateUserStatus } = useAuth();
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const areaRef = useRef(null);

    useEffect(() => {
        if (!showStatusPicker) return;
        const onClickOutside = (e) => {
            if (areaRef.current && !areaRef.current.contains(e.target)) setShowStatusPicker(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [showStatusPicker]);

    const handleSetStatusMessage = async (msg) => {
        try {
            await setDoc(doc(db, 'users', currentUser.uid), { statusMessage: msg }, { merge: true });
        } catch (e) { if (import.meta.env.DEV) console.error(e); }
    };

    const userStatus = currentUser?.status || 'online';
    const statusColor = getStatusColor(userStatus);

    return (
        <motion.div
            ref={areaRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
                padding: '8px', position: 'relative',
                background: 'linear-gradient(180deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02)), rgba(8,5,18,0.9)',
                borderTop: '1px solid rgba(168,85,247,0.12)',
                display: 'flex', alignItems: 'center', gap: '8px',
            }}
        >
            <AnimatePresence>
                {showStatusPicker && (
                    <StatusPicker
                        currentStatus={userStatus}
                        currentStatusMessage={currentUser?.statusMessage}
                        onSelectStatus={updateUserStatus}
                        onSetStatusMessage={handleSetStatusMessage}
                        onClose={() => setShowStatusPicker(false)}
                    />
                )}
            </AnimatePresence>

            {/* Avatar + status dot (clickable to open status picker) */}
            <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowStatusPicker(!showStatusPicker)}
                style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
                title="Change status"
            >
                <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 800, color: 'white',
                    boxShadow: '0 0 12px rgba(168,85,247,0.35)',
                    backgroundImage: currentUser?.photoURL ? `url(${currentUser.photoURL})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                }}>
                    {!currentUser?.photoURL && (currentUser?.email?.[0]?.toUpperCase() || 'U')}
                </div>
                <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '11px', height: '11px', borderRadius: '50%',
                    backgroundColor: statusColor,
                    border: '2px solid var(--bg-secondary)',
                    boxShadow: `0 0 8px ${statusColor}80`,
                    transition: 'background-color 0.3s',
                }} />
            </motion.div>

            {/* Name + custom status */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: userRoleColor || 'var(--text-primary)' }}>
                    {currentUser?.displayName || 'User'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {currentUser?.statusMessage || `#${currentUser?.uid?.substring(0, 4) || '0000'}`}
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '2px' }}>
                <motion.button className="icon-btn" whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} title="Mute microphone"><Mic size={16} /></motion.button>
                <motion.button className="icon-btn" whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} title="Deafen"><Headphones size={16} /></motion.button>
                <motion.button className="icon-btn" whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={onSettings} title="Settings"><Settings size={16} /></motion.button>
            </div>
        </motion.div>
    );
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function ChannelList({ activeServerId, activeChannelId, setActiveChannelId, setActiveChannelName, isMobileView, setActiveDmUser }) {
    const { currentUser } = useAuth();
    const [serverData, setServerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dms, setDms] = useState([]);
    const [showDmSearch, setShowDmSearch] = useState(false);
    const [dmSearchQuery, setDmSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [currentUserMember, setCurrentUserMember] = useState(null);
    const [roles, setRoles] = useState([]);
    const [userRoleColor, setUserRoleColor] = useState(null);

    // Unread channel tracking — { [channelId]: boolean }
    const [unreadChannels, setUnreadChannels] = useState({});

    // Collapsible categories — persisted in localStorage
    const [collapsedCategories, setCollapsedCategories] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('collapsedCategories') || '[]')); }
        catch { return new Set(); }
    });

    // Server header dropdown + invite modal
    const [showServerMenu, setShowServerMenu] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const serverMenuRef = useRef(null);

    const toggleCategory = (cat) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            try { localStorage.setItem('collapsedCategories', JSON.stringify([...next])); } catch {}
            return next;
        });
    };

    // Close server menu on outside click
    useEffect(() => {
        if (!showServerMenu) return;
        const onClick = (e) => { if (serverMenuRef.current && !serverMenuRef.current.contains(e.target)) setShowServerMenu(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [showServerMenu]);

    /* ── Data fetching ─────────────────────────────────────────────────── */
    useEffect(() => {
        setLoading(true);
        if (activeServerId === 'home') {
            setServerData({ name: 'Direct Messages' });
            setLoading(false);
            if (currentUser) {
                const q = query(collection(db, 'dms'), where('participants', 'array-contains', currentUser.uid));
                const unsubscribe = onSnapshot(q, async (snapshot) => {
                    const dmList = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                        const data = docSnapshot.data();
                        const otherUserId = data.participants.find(uid => uid !== currentUser.uid);
                        let otherUser = { displayName: 'Unknown User', uid: otherUserId };
                        try {
                            const userDoc = await getDoc(doc(db, 'users', otherUserId));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                const isOnline = userData.lastSeen && (new Date() - userData.lastSeen.toDate()) < 2 * 60 * 1000;
                                let userStatus = 'offline';
                                if (isOnline) {
                                    userStatus = userData.status || 'online';
                                    if (userStatus === 'invisible') userStatus = 'offline';
                                }
                                otherUser = { ...userData, status: userStatus };
                            }
                        } catch (e) {
                            if (import.meta.env.DEV) console.error('Error fetching DM user', e);
                        }
                        return { id: docSnapshot.id, otherUser, ...data };
                    }));
                    setDms(dmList);
                });
                return unsubscribe;
            }
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'servers', activeServerId), (d) => {
            if (d.exists()) {
                const data = d.data();
                setServerData(data);
                setLoading(false);
                if (!activeChannelId && data.channels?.length > 0 && !isMobileView) {
                    const first = data.channels.find(c => c.type === 'text');
                    if (first) {
                        setActiveChannelId(`${activeServerId}-${first.name}`);
                        setActiveChannelName(first.name);
                    }
                }
            }
        });

        const memberUnsub = onSnapshot(doc(db, 'servers', activeServerId, 'members', currentUser.uid), (d) => {
            setCurrentUserMember(d.exists() ? d.data() : null);
        });

        const rolesUnsub = onSnapshot(
            query(collection(db, 'servers', activeServerId, 'roles'), orderBy('position', 'asc')),
            (snap) => setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        return () => { unsubscribe(); memberUnsub(); rolesUnsub(); };
    }, [activeServerId, currentUser, isMobileView]);

    useEffect(() => {
        if (currentUserMember && roles.length > 0 && currentUserMember.roles?.length > 0) {
            const highestRole = roles.find(r => currentUserMember.roles.includes(r.id));
            setUserRoleColor(highestRole?.color || null);
        } else {
            setUserRoleColor(null);
        }
    }, [currentUserMember, roles]);

    /* ── DM search ─────────────────────────────────────────────────────── */
    useEffect(() => {
        const searchUsers = async () => {
            if (!dmSearchQuery.trim()) { setSearchResults([]); return; }
            setIsSearching(true);
            try {
                const searchLower = dmSearchQuery.toLowerCase();
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('displayName', '>=', dmSearchQuery), where('displayName', '<=', dmSearchQuery + '\uf8ff'));
                const snap = await getDocs(q);
                const results = [];
                snap.forEach(d => { if (d.data().uid !== currentUser.uid) results.push(d.data()); });
                if (results.length === 0) {
                    const qL = query(usersRef, where('displayNameLower', '>=', searchLower), where('displayNameLower', '<=', searchLower + '\uf8ff'));
                    const lSnap = await getDocs(qL);
                    lSnap.forEach(d => { if (d.data().uid !== currentUser.uid) results.push(d.data()); });
                }
                setSearchResults(results.slice(0, 20));
            } catch (err) {
                if (import.meta.env.DEV) console.error('Search error:', err);
            } finally {
                setIsSearching(false);
            }
        };
        const t = setTimeout(searchUsers, 300);
        return () => clearTimeout(t);
    }, [dmSearchQuery, currentUser]);

    /* ── Actions ───────────────────────────────────────────────────────── */
    const handleCreateChannel = async () => {
        const channelName = prompt('Enter channel name:');
        if (!channelName) return;
        try {
            await updateDoc(doc(db, 'servers', activeServerId), {
                channels: arrayUnion({ name: channelName.toLowerCase().replace(/\s+/g, '-'), type: 'text', category: 'Text Channels' })
            });
        } catch (err) {
            if (import.meta.env.DEV) console.error(err);
            alert('Failed to create channel');
        }
    };

    const startDMWithUser = async (targetUser) => {
        try {
            const sortedIds = [currentUser.uid, targetUser.uid].sort();
            const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
            await setDoc(doc(db, 'dms', dmId), { participants: sortedIds, updatedAt: new Date(), startedBy: currentUser.uid }, { merge: true });
            setActiveChannelId(dmId);
            setActiveChannelName(targetUser.displayName);
            if (setActiveDmUser) setActiveDmUser(targetUser);
            setShowDmSearch(false);
            setDmSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error starting DM:', err);
            alert('Error starting DM');
        }
    };

    const handleDeleteChannel = async (channel) => {
        if (!confirm(`Delete #${channel.name}? This can't be undone.`)) return;
        try {
            await updateDoc(doc(db, 'servers', activeServerId), { channels: arrayRemove(channel) });
            if (activeChannelId === `${activeServerId}-${channel.name}`) {
                setActiveChannelId(null); setActiveChannelName(null);
            }
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error deleting channel:', err);
            alert('Failed to delete channel');
        }
    };

    // Mark channel as read when activated
    useEffect(() => {
        if (activeChannelId) {
            setUnreadChannels(prev => ({ ...prev, [activeChannelId]: false }));
        }
    }, [activeChannelId]);

    const canManageChannels = hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.MANAGE_CHANNELS);

    const shellStyle = {
        width: isMobileView ? '100%' : '240px',
        height: isMobileView ? '100%' : 'var(--app-vh)',
        background: 'linear-gradient(180deg, rgba(11,8,24,0.98) 0%, rgba(13,10,26,0.98) 100%)',
        display: 'flex', flexDirection: 'column',
        borderRight: isMobileView ? 'none' : '1px solid rgba(168,85,247,0.1)',
    };

    /* ── Home / DMs view ───────────────────────────────────────────────── */
    if (activeServerId === 'home') {
        return (
            <div className="liquid-panel channel-list-shell" style={shellStyle}>
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    style={{ height: '52px', padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(168,85,247,0.1)', fontWeight: 800, fontSize: '15px', background: 'linear-gradient(90deg, rgba(168,85,247,0.06), transparent)', letterSpacing: '-0.01em' }}>
                    <MessageCircle size={18} color="#a855f7" style={{ marginRight: '10px' }} />
                    Direct Messages
                </motion.div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                    <div style={{ padding: '0 8px 8px' }}>
                        <motion.button
                            className="liquid-tile-button"
                            whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setActiveChannelId('friends')}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center',
                                padding: '9px 12px',
                                backgroundColor: activeChannelId === 'friends' ? 'rgba(168,85,247,0.14)' : 'transparent',
                                color: activeChannelId === 'friends' ? '#c084fc' : 'var(--text-secondary)',
                                border: 'none', borderRadius: '8px', cursor: 'pointer',
                                fontWeight: 600, fontSize: '14px', marginBottom: '8px',
                                borderLeft: activeChannelId === 'friends' ? '2px solid #a855f7' : '2px solid transparent',
                            }}
                        >
                            <UserPlus size={18} style={{ marginRight: '10px' }} />
                            Friends
                        </motion.button>

                        <motion.button
                            className="glossy-button" whileTap={{ scale: 0.97 }}
                            style={{ width: '100%', fontSize: '13px', padding: '9px 12px', borderRadius: '10px' }}
                            onClick={() => setShowDmSearch(!showDmSearch)}
                        >
                            {showDmSearch ? 'Close' : 'Start Conversation'}
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {showDmSearch && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                                style={{ padding: '0 12px 12px', overflow: 'hidden' }}
                            >
                                <input
                                    type="text" placeholder="Search users..."
                                    value={dmSearchQuery} onChange={(e) => setDmSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', fontSize: '13px' }}
                                    autoFocus
                                />
                                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                                    {isSearching ? (
                                        <><SkeletonRow width="90%" /><SkeletonRow width="75%" delay={0.05} /></>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map((user, i) => (
                                            <motion.div key={user.uid} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                                onClick={() => startDMWithUser(user)}
                                                className="liquid-list-item"
                                                style={{ display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', backgroundImage: user.photoURL ? `url(${user.photoURL})` : 'none', backgroundSize: 'cover', marginRight: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(168,85,247,0.2)' }}>
                                                    {!user.photoURL && user.displayName?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.displayName}</div>
                                                    {user.statusMessage && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.statusMessage}</div>}
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : dmSearchQuery && (
                                        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No users found.</div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {dms.length > 0 && (
                        <div style={{ padding: '4px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Recent
                        </div>
                    )}

                    <AnimatePresence>
                        {dms.map((dm, index) => (
                            <DMItem key={dm.id} index={index} user={dm.otherUser} active={activeChannelId === dm.id}
                                onClick={() => {
                                    setActiveChannelId(dm.id);
                                    setActiveChannelName(dm.otherUser.displayName);
                                    if (setActiveDmUser) setActiveDmUser(dm.otherUser);
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                <UserArea currentUser={currentUser} userRoleColor={userRoleColor} onSettings={() => setIsSettingsOpen(true)} />
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        );
    }

    /* ── Server channel view ───────────────────────────────────────────── */
    // Group channels by category
    const categories = serverData?.categories || ['Text Channels', 'Voice Channels'];
    const channelsByCategory = {};
    (serverData?.channels || []).forEach(ch => {
        const cat = ch.category || (ch.type === 'voice' ? 'Voice Channels' : 'Text Channels');
        if (!channelsByCategory[cat]) channelsByCategory[cat] = [];
        channelsByCategory[cat].push(ch);
    });

    // Include any extra categories from the serverData.categories list
    categories.forEach(cat => {
        if (!channelsByCategory[cat]) channelsByCategory[cat] = [];
    });

    return (
        <div className="liquid-panel channel-list-shell" style={shellStyle}>
            {/* Server header with dropdown */}
            <div ref={serverMenuRef} style={{ position: 'relative' }}>
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => setShowServerMenu(!showServerMenu)}
                    style={{
                        height: '52px', padding: '0 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(168,85,247,0.1)',
                        cursor: 'pointer', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em',
                        background: showServerMenu
                            ? 'linear-gradient(90deg, rgba(168,85,247,0.12), rgba(168,85,247,0.06))'
                            : 'linear-gradient(90deg, rgba(168,85,247,0.06), transparent)',
                        transition: 'background 0.2s',
                    }}
                    whileHover={{ backgroundColor: 'rgba(168,85,247,0.05)' }}
                >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {serverData?.name || 'Loading...'}
                    </span>
                    <motion.div animate={{ rotate: showServerMenu ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={18} color="var(--text-muted)" />
                    </motion.div>
                </motion.div>

                {/* Server dropdown menu */}
                <AnimatePresence>
                    {showServerMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: -6, scaleY: 0.9 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute', top: '100%', left: '8px', right: '8px',
                                zIndex: 200,
                                background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                                border: '1px solid rgba(168,85,247,0.22)',
                                borderRadius: '12px', padding: '6px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}
                        >
                            <motion.div
                                whileHover={{ backgroundColor: 'rgba(168,85,247,0.12)' }}
                                onClick={() => { setShowServerMenu(false); setShowInvite(true); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', color: '#c084fc', transition: 'background-color 0.1s' }}
                            >
                                <Link size={16} />
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>Invite People</span>
                            </motion.div>
                            <div style={{ height: '1px', background: 'rgba(168,85,247,0.1)', margin: '4px 0' }} />
                            <motion.div
                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'background-color 0.1s' }}
                            >
                                <Settings size={16} />
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>Server Settings</span>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Invite modal (portal) */}
            <AnimatePresence>
                {showInvite && (
                    <InviteModalPortal
                        inviteCode={serverData?.inviteCode || '???'}
                        serverName={serverData?.name || 'Server'}
                        onClose={() => setShowInvite(false)}
                    />
                )}
            </AnimatePresence>

            {/* Channels */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '8px' }}>
                {loading ? (
                    <>
                        <div style={{ padding: '16px 16px 4px' }}>
                            <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '6px' }} />
                        </div>
                        <SkeletonRow width="80%" />
                        <SkeletonRow width="65%" delay={0.05} />
                        <SkeletonRow width="75%" delay={0.1} />
                    </>
                ) : (
                    Object.entries(channelsByCategory).map(([cat, channels]) => (
                        <div key={cat}>
                            <SectionHeader
                                label={cat}
                                collapsed={collapsedCategories.has(cat)}
                                onToggle={() => toggleCategory(cat)}
                                onAdd={cat.toLowerCase().includes('voice') ? undefined : handleCreateChannel}
                                canAdd={!cat.toLowerCase().includes('voice') && canManageChannels}
                            />
                            <AnimatePresence initial={false}>
                                {!collapsedCategories.has(cat) && channels.map((channel, index) => {
                                    const uid = `${activeServerId}-${channel.name}`;
                                    return (
                                        <motion.div
                                            key={channel.name}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <ChannelItem
                                                index={index}
                                                name={channel.name}
                                                type={channel.type}
                                                active={activeChannelId === uid}
                                                hasUnread={!!unreadChannels[uid]}
                                                onClick={() => {
                                                    setActiveChannelId(uid);
                                                    setActiveChannelName(channel.name);
                                                    setUnreadChannels(prev => ({ ...prev, [uid]: false }));
                                                }}
                                                onDelete={() => handleDeleteChannel(channel)}
                                                canDelete={canManageChannels}
                                            />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    ))
                )}
            </div>

            <UserArea currentUser={currentUser} userRoleColor={userRoleColor} onSettings={() => setIsSettingsOpen(true)} />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
}

/* ── Invite modal via portal ─────────────────────────────────────────── */
function InviteModalPortal({ inviteCode, serverName, onClose }) {
    return createPortal(
        <InviteModal inviteCode={inviteCode} serverName={serverName} onClose={onClose} />,
        document.body
    );
}
