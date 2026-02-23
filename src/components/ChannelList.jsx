import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Volume2, ChevronDown, ChevronRight, Mic, MicOff, Headphones, Settings, Plus, MessageCircle, X, UserPlus, Trash2, Link, Check, Circle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, where, getDocs, setDoc, getDoc, arrayRemove, orderBy, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import SettingsModal from './SettingsModal';
import ServerSettingsModal from './ServerSettingsModal';
import { hasPermission, PERMISSIONS, isServerOwner } from '../utils/permissions';
import userAvatar from '../assets/user_avatar.png';
import { resolveAvatarUrl } from '../utils/avatarUrl';
import { useVoiceControls } from '../context/VoiceControlsContext';
import { appAlert, appConfirm, appPrompt } from '../utils/dialogService';

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

const normalizeStatusFromUserData = (userData) => {
    const lastSeen = userData?.lastSeen?.toDate?.() || null;
    const isOnline = !!lastSeen && (Date.now() - lastSeen.getTime()) < 2 * 60 * 1000;
    if (!isOnline) return 'offline';

    const status = userData?.status || 'online';
    return status === 'invisible' ? 'offline' : status;
};

const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value === 'number') return value;
    return 0;
};

function AvatarBubble({ photoURL, displayName, size = 34, fallbackBorder = '1px solid rgba(168,85,247,0.18)' }) {
    const [avatarError, setAvatarError] = useState(false);
    const resolvedPhotoURL = resolveAvatarUrl(photoURL);

    useEffect(() => {
        setAvatarError(false);
    }, [resolvedPhotoURL]);

    const hasPhoto = !!resolvedPhotoURL && !avatarError;
    const fallbackInitial = (displayName || 'U').trim().charAt(0).toUpperCase();

    return (
        <div style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: 'var(--bg-tertiary)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: `${Math.max(11, Math.floor(size * 0.36))}px`,
            border: fallbackBorder,
            flexShrink: 0,
        }}>
            {hasPhoto ? (
                <img
                    src={resolvedPhotoURL}
                    alt={displayName || 'User avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                fallbackInitial || 'U'
            )}
        </div>
    );
}

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
const DMItem = ({ dm, active, onClick, index, onOpenGroupSettings }) => (
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
            {dm.kind === 'group' && !dm.photoURL ? (
                <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c084fc',
                }}>
                    <Users size={16} />
                </div>
            ) : (
                <AvatarBubble photoURL={dm.photoURL || userAvatar} displayName={dm.displayName} size={34} />
            )}
            {dm.kind !== 'group' && (
                <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '11px', height: '11px', borderRadius: '50%',
                    backgroundColor: getStatusColor(dm.status),
                    border: '2px solid var(--bg-secondary)',
                }} />
            )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: active ? 600 : 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dm.displayName}
            </div>
            {(dm.subtitle || dm.statusMessage) && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dm.subtitle || dm.statusMessage}
                </div>
            )}
        </div>
        {dm.kind === 'group' && (
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenGroupSettings?.(dm);
                }}
                className="icon-btn"
                title="Group chat settings"
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <Settings size={14} />
            </button>
        )}
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

function GroupChatCreatorModal({
    isOpen,
    onClose,
    candidates,
    selectedIds,
    onToggleMember,
    groupName,
    setGroupName,
    searchQuery,
    setSearchQuery,
    onCreate,
    loading,
    creating,
}) {
    if (!isOpen) return null;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const filteredCandidates = candidates.filter((candidate) =>
        (candidate.displayName || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2,1,8,0.82)',
                backdropFilter: 'blur(8px)',
                zIndex: 3200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '0' : '16px',
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : '520px',
                    height: isMobile ? '100%' : 'auto',
                    maxHeight: isMobile ? '100%' : 'min(86vh, 680px)',
                    background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                    border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: isMobile ? '0' : '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{
                    padding: isMobile ? 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px' : '14px 16px',
                    borderBottom: '1px solid rgba(168,85,247,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Group Chat</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Select at least 2 people
                        </p>
                    </div>
                    <button onClick={onClose} className="icon-btn" style={{ width: '30px', height: '30px' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                        type="text"
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value.slice(0, 60))}
                        placeholder="Group name (optional)"
                        style={{ width: '100%', padding: '9px 11px', fontSize: '13px' }}
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search friends"
                        style={{ width: '100%', padding: '9px 11px', fontSize: '13px' }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
                    {loading ? (
                        <div style={{ padding: '18px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            Loading friends...
                        </div>
                    ) : filteredCandidates.length === 0 ? (
                        <div style={{ padding: '18px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            No friends found for this filter.
                        </div>
                    ) : (
                        filteredCandidates.map((candidate) => {
                            const selected = selectedIds.has(candidate.uid);
                            return (
                                <button
                                    key={candidate.uid}
                                    type="button"
                                    onClick={() => onToggleMember(candidate.uid)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '9px 10px',
                                        marginBottom: '4px',
                                        borderRadius: '10px',
                                        border: selected ? '1px solid rgba(168,85,247,0.45)' : '1px solid transparent',
                                        background: selected ? 'rgba(168,85,247,0.14)' : 'transparent',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    {selected ? <Check size={14} color="#c084fc" /> : <Circle size={14} color="var(--text-muted)" />}
                                    <AvatarBubble
                                        photoURL={candidate.photoURL || userAvatar}
                                        displayName={candidate.displayName}
                                        size={30}
                                        fallbackBorder="1px solid rgba(168,85,247,0.25)"
                                    />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {candidate.displayName || 'Unknown User'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {candidate.email || ''}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                <div style={{
                    borderTop: '1px solid rgba(168,85,247,0.14)',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {selectedIds.size} selected
                    </span>
                    <button
                        type="button"
                        onClick={onCreate}
                        className="glossy-button"
                        disabled={creating || selectedIds.size < 2}
                        style={{ opacity: (creating || selectedIds.size < 2) ? 0.6 : 1 }}
                    >
                        {creating ? 'Creating...' : 'Create Group'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function GroupChatSettingsModal({
    isOpen,
    onClose,
    dm,
    isOwner,
    onSave,
    onLeave,
    onDelete,
    saving,
    leaving,
    deleting,
}) {
    const [nameInput, setNameInput] = useState('');
    const [photoUrlInput, setPhotoUrlInput] = useState('');
    const fileInputRef = useRef(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const busy = saving || leaving || deleting;

    useEffect(() => {
        if (!isOpen || !dm) return;
        setNameInput((dm.name || dm.displayName || 'Group Chat').slice(0, 60));
        setPhotoUrlInput(dm.photoURL || '');
    }, [isOpen, dm?.id, dm?.name, dm?.displayName, dm?.photoURL]);

    if (!isOpen || !dm) return null;

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            await appAlert('Please select an image file.', { title: 'Invalid File', danger: true });
            event.target.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            await appAlert('Group photo must be under 2 MB.', { title: 'File Too Large', danger: true });
            event.target.value = '';
            return;
        }

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read file.'));
                reader.readAsDataURL(file);
            });
            setPhotoUrlInput(dataUrl);
        } catch (_) {
            await appAlert('Could not process image file.', { title: 'Upload Failed', danger: true });
        } finally {
            event.target.value = '';
        }
    };

    const previewUrl = resolveAvatarUrl(photoUrlInput || dm.photoURL || '');
    const fallbackInitial = (nameInput || dm.displayName || 'G').trim().charAt(0).toUpperCase();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!busy) onClose(); }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2,1,8,0.82)',
                backdropFilter: 'blur(8px)',
                zIndex: 3400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '0' : '16px',
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : '520px',
                    height: isMobile ? '100%' : 'auto',
                    maxHeight: isMobile ? '100%' : 'min(86vh, 680px)',
                    background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                    border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: isMobile ? '0' : '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{
                    padding: isMobile ? 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px' : '14px 16px',
                    borderBottom: '1px solid rgba(168,85,247,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Group Chat Settings</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {isOwner ? 'Manage your group chat.' : 'Only the group owner can edit details.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="icon-btn" style={{ width: '30px', height: '30px' }} disabled={busy}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid rgba(168,85,247,0.2)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#c084fc',
                            fontSize: '22px',
                            fontWeight: 700,
                            flexShrink: 0,
                        }}>
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt={nameInput || 'Group chat'}
                                    referrerPolicy="no-referrer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                fallbackInitial || 'G'
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {nameInput || dm.displayName || 'Group Chat'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {Array.isArray(dm.participants) ? dm.participants.length : 0} members
                            </div>
                        </div>
                    </div>

                    {isOwner && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Group Name
                                </label>
                                <input
                                    type="text"
                                    value={nameInput}
                                    onChange={(event) => setNameInput(event.target.value.slice(0, 60))}
                                    placeholder="Group chat name"
                                    disabled={busy}
                                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Group Photo URL
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={photoUrlInput}
                                        onChange={(event) => setPhotoUrlInput(event.target.value)}
                                        placeholder="https://example.com/group-photo.png"
                                        disabled={busy}
                                        style={{ flex: 1, padding: '10px 12px', fontSize: '13px' }}
                                    />
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={busy}
                                        style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
                                    >
                                        Upload
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => setPhotoUrlInput('')}
                                        disabled={busy}
                                        style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
                                    >
                                        Remove
                                    </button>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div style={{
                    borderTop: '1px solid rgba(168,85,247,0.14)',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={onLeave}
                        disabled={busy}
                        style={{ padding: '8px 12px' }}
                    >
                        {leaving ? 'Leaving...' : 'Leave Group'}
                    </button>

                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                        {isOwner && (
                            <>
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={onDelete}
                                    disabled={busy}
                                    style={{
                                        padding: '8px 12px',
                                        color: '#fda4af',
                                        borderColor: 'rgba(248,113,113,0.35)',
                                        backgroundColor: 'rgba(127,29,29,0.2)',
                                    }}
                                >
                                    {deleting ? 'Deleting...' : 'Delete Group'}
                                </button>
                                <button
                                    type="button"
                                    className="glossy-button"
                                    onClick={() => onSave({ name: nameInput, photoURL: photoUrlInput })}
                                    disabled={busy}
                                    style={{ padding: '8px 14px' }}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
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
    const { isMicMuted, isDeafened, toggleMicMute, toggleDeafen } = useVoiceControls();
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
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.85, rotate: -5 }}
                onClick={() => setShowStatusPicker(!showStatusPicker)}
                onContextMenu={(e) => { e.preventDefault(); onSettings(); }}
                style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
                title="Left click: Change status | Right click: Edit Profile"
            >
                <AvatarBubble photoURL={currentUser?.photoURL} displayName={currentUser?.displayName || currentUser?.email} size={34} />
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
                <motion.button
                    className="icon-btn"
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleMicMute}
                    title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                    style={{
                        color: isMicMuted ? '#f97316' : undefined,
                        backgroundColor: isMicMuted ? 'rgba(249, 115, 22, 0.14)' : undefined,
                        border: isMicMuted ? '1px solid rgba(249, 115, 22, 0.35)' : undefined,
                    }}
                >
                    {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </motion.button>
                <motion.button
                    className="icon-btn"
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleDeafen}
                    title={isDeafened ? "Undeafen" : "Deafen"}
                    style={{
                        color: isDeafened ? '#f97316' : undefined,
                        backgroundColor: isDeafened ? 'rgba(249, 115, 22, 0.14)' : undefined,
                        border: isDeafened ? '1px solid rgba(249, 115, 22, 0.35)' : undefined,
                    }}
                >
                    <Headphones size={16} />
                </motion.button>
                <motion.button className="icon-btn" whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={onSettings} title="Settings"><Settings size={16} /></motion.button>
            </div>
        </motion.div>
    );
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function ChannelList({ activeServerId, activeChannelId, setActiveChannelId, setActiveChannelName, setActiveChannelType, isMobileView, setActiveDmUser }) {
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
    const [showGroupCreator, setShowGroupCreator] = useState(false);
    const [groupCandidates, setGroupCandidates] = useState([]);
    const [groupCandidatesLoading, setGroupCandidatesLoading] = useState(false);
    const [groupCreating, setGroupCreating] = useState(false);
    const [groupNameInput, setGroupNameInput] = useState('');
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [groupSelectedIds, setGroupSelectedIds] = useState(new Set());
    const [groupSettingsDmId, setGroupSettingsDmId] = useState(null);
    const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
    const [groupSettingsLeaving, setGroupSettingsLeaving] = useState(false);
    const [groupSettingsDeleting, setGroupSettingsDeleting] = useState(false);

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
    const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
    const serverMenuRef = useRef(null);
    const groupSettingsDm = dms.find((dm) => dm.id === groupSettingsDmId) || null;
    const groupSettingsOwnerId = groupSettingsDm
        ? (groupSettingsDm.ownerId || groupSettingsDm.createdBy || groupSettingsDm.participants?.[0] || null)
        : null;
    const canManageCurrentGroup = !!groupSettingsDm && groupSettingsOwnerId === currentUser?.uid;

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
                    const dmList = await Promise.all(snapshot.docs.map(async (dmDoc) => {
                        const data = dmDoc.data();
                        const participants = Array.isArray(data.participants) ? data.participants : [];

                        if (data.isGroup) {
                            const otherMemberIds = participants.filter((uid) => uid !== currentUser.uid);
                            const memberProfiles = await Promise.all(otherMemberIds.map(async (uid) => {
                                try {
                                    const userSnap = await getDoc(doc(db, 'users', uid));
                                    if (!userSnap.exists()) return null;
                                    return { uid, ...userSnap.data() };
                                } catch (_) {
                                    return null;
                                }
                            }));

                            const validMembers = memberProfiles.filter(Boolean);
                            const memberNames = validMembers
                                .map((member) => member.displayName)
                                .filter(Boolean);
                            const fallbackName = memberNames.length > 0
                                ? memberNames.slice(0, 3).join(', ')
                                : 'Group Chat';
                            const displayName = data.name?.trim() || fallbackName;
                            const subtitle = `${participants.length || 0} members`;
                            const ownerId = data.ownerId || data.createdBy || participants[0] || null;

                            return {
                                id: dmDoc.id,
                                ...data,
                                kind: 'group',
                                displayName,
                                subtitle,
                                ownerId,
                                status: 'online',
                            };
                        }

                        const otherUserId = participants.find((uid) => uid !== currentUser.uid);
                        let otherUser = { uid: otherUserId, displayName: 'Unknown User', photoURL: '', status: 'offline' };
                        try {
                            if (otherUserId) {
                                const userDoc = await getDoc(doc(db, 'users', otherUserId));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    otherUser = {
                                        uid: otherUserId,
                                        ...userData,
                                        status: normalizeStatusFromUserData(userData),
                                    };
                                }
                            }
                        } catch (e) {
                            if (import.meta.env.DEV) console.error('Error fetching DM user', e);
                        }

                        return {
                            id: dmDoc.id,
                            ...data,
                            kind: 'direct',
                            displayName: otherUser.displayName || 'Unknown User',
                            photoURL: otherUser.photoURL || '',
                            status: otherUser.status || 'offline',
                            statusMessage: otherUser.statusMessage || otherUser.customStatus || '',
                            otherUser,
                        };
                    }));

                    dmList.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
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
                        if (setActiveChannelType) setActiveChannelType(first.type || 'text');
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
                snap.forEach((d) => {
                    if (d.id !== currentUser.uid) results.push({ uid: d.id, ...d.data() });
                });
                if (results.length === 0) {
                    const qL = query(usersRef, where('displayNameLower', '>=', searchLower), where('displayNameLower', '<=', searchLower + '\uf8ff'));
                    const lSnap = await getDocs(qL);
                    lSnap.forEach((d) => {
                        if (d.id !== currentUser.uid) results.push({ uid: d.id, ...d.data() });
                    });
                }
                const deduped = [];
                const seen = new Set();
                results.forEach((user) => {
                    if (!user?.uid || seen.has(user.uid)) return;
                    seen.add(user.uid);
                    deduped.push(user);
                });
                setSearchResults(deduped.slice(0, 20));
            } catch (err) {
                if (import.meta.env.DEV) console.error('Search error:', err);
            } finally {
                setIsSearching(false);
            }
        };
        const t = setTimeout(searchUsers, 300);
        return () => clearTimeout(t);
    }, [dmSearchQuery, currentUser]);

    useEffect(() => {
        if (!showGroupCreator || !currentUser?.uid) return;

        let cancelled = false;
        const fetchCandidates = async () => {
            setGroupCandidatesLoading(true);
            try {
                const friendsQuery = query(
                    collection(db, 'users', currentUser.uid, 'friends'),
                    where('status', '==', 'accepted')
                );
                const friendsSnap = await getDocs(friendsQuery);
                const friendIds = friendsSnap.docs.map((friendDoc) => friendDoc.id);

                const candidateDocs = await Promise.all(friendIds.map(async (friendUid) => {
                    try {
                        const userSnap = await getDoc(doc(db, 'users', friendUid));
                        if (!userSnap.exists()) return null;
                        return { uid: friendUid, ...userSnap.data() };
                    } catch (_) {
                        return null;
                    }
                }));

                if (!cancelled) {
                    const candidates = candidateDocs
                        .filter(Boolean)
                        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
                    setGroupCandidates(candidates);
                }
            } catch (error) {
                if (import.meta.env.DEV) console.error('Error loading group chat candidates:', error);
                if (!cancelled) setGroupCandidates([]);
            } finally {
                if (!cancelled) setGroupCandidatesLoading(false);
            }
        };

        fetchCandidates();
        return () => { cancelled = true; };
    }, [showGroupCreator, currentUser?.uid]);

    /* ── Actions ───────────────────────────────────────────────────────── */
    const handleCreateChannel = async () => {
        const channelName = await appPrompt('Enter channel name:', {
            title: 'Create Channel',
            placeholder: 'new-channel',
            confirmText: 'Create',
            cancelText: 'Cancel'
        });
        if (!channelName) return;
        try {
            await updateDoc(doc(db, 'servers', activeServerId), {
                channels: arrayUnion({ name: channelName.toLowerCase().replace(/\s+/g, '-'), type: 'text', category: 'Text Channels' })
            });
        } catch (err) {
            if (import.meta.env.DEV) console.error(err);
            await appAlert('Failed to create channel.', { title: 'Channel Error', danger: true });
        }
    };

    const startDMWithUser = async (targetUser) => {
        try {
            const sortedIds = [currentUser.uid, targetUser.uid].sort();
            const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
            await setDoc(doc(db, 'dms', dmId), {
                participants: sortedIds,
                isGroup: false,
                updatedAt: serverTimestamp(),
                startedBy: currentUser.uid
            }, { merge: true });
            setActiveChannelId(dmId);
            setActiveChannelName(targetUser.displayName);
            if (setActiveChannelType) setActiveChannelType('dm');
            if (setActiveDmUser) setActiveDmUser(targetUser);
            setShowDmSearch(false);
            setDmSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error starting DM:', err);
            await appAlert('Error starting DM.', { title: 'DM Error', danger: true });
        }
    };

    const openGroupCreator = () => {
        setGroupSelectedIds(new Set());
        setGroupSearchQuery('');
        setGroupNameInput('');
        setShowGroupCreator(true);
    };

    const closeGroupCreator = (force = false) => {
        if (!force && groupCreating) return;
        setShowGroupCreator(false);
        setGroupSelectedIds(new Set());
        setGroupSearchQuery('');
        setGroupNameInput('');
    };

    const toggleGroupMember = (uid) => {
        setGroupSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const createGroupChat = async () => {
        if (!currentUser?.uid || groupCreating) return;

        const selectedMemberIds = [...groupSelectedIds].filter((uid) => uid && uid !== currentUser.uid);
        if (selectedMemberIds.length < 2) {
            await appAlert('Please select at least 2 members for a group chat.', { title: 'Group Chat', danger: true });
            return;
        }

        setGroupCreating(true);
        try {
            const participants = [currentUser.uid, ...selectedMemberIds];
            const selectedMembers = groupCandidates.filter((candidate) => groupSelectedIds.has(candidate.uid));
            const fallbackName = selectedMembers
                .map((member) => member.displayName)
                .filter(Boolean)
                .slice(0, 3)
                .join(', ') || 'Group Chat';
            const finalName = groupNameInput.trim() || fallbackName;

            const groupDocRef = await addDoc(collection(db, 'dms'), {
                isGroup: true,
                name: finalName,
                participants,
                ownerId: currentUser.uid,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setActiveChannelId(groupDocRef.id);
            setActiveChannelName(finalName);
            if (setActiveChannelType) setActiveChannelType('group-dm');
            if (setActiveDmUser) setActiveDmUser(null);

            closeGroupCreator(true);
        } catch (error) {
            if (import.meta.env.DEV) console.error('Error creating group chat:', error);
            await appAlert('Failed to create group chat.', { title: 'Group Chat Error', danger: true });
        } finally {
            setGroupCreating(false);
        }
    };

    const switchToFriends = () => {
        setActiveChannelId('friends');
        setActiveChannelName('Friends');
        if (setActiveChannelType) setActiveChannelType('friends');
        if (setActiveDmUser) setActiveDmUser(null);
    };

    const openGroupSettings = (dm) => {
        if (!dm || dm.kind !== 'group') return;
        setGroupSettingsDmId(dm.id);
    };

    const closeGroupSettings = (force = false) => {
        if (!force && (groupSettingsSaving || groupSettingsLeaving || groupSettingsDeleting)) return;
        setGroupSettingsDmId(null);
    };

    const deleteGroupMessages = async (channelId) => {
        if (!channelId) return;
        const messagesSnap = await getDocs(query(collection(db, 'messages'), where('channel', '==', channelId)));
        await Promise.all(messagesSnap.docs.map((messageDoc) => deleteDoc(messageDoc.ref)));
    };

    const saveGroupSettings = async ({ name, photoURL }) => {
        if (!groupSettingsDm || !canManageCurrentGroup || groupSettingsSaving) return;

        const trimmedName = String(name || '').trim().slice(0, 60);
        const trimmedPhotoURL = String(photoURL || '').trim();

        if (!trimmedName) {
            await appAlert('Group name cannot be empty.', { title: 'Invalid Name', danger: true });
            return;
        }

        if (trimmedPhotoURL && !/^https?:\/\//i.test(trimmedPhotoURL) && !/^data:image\//i.test(trimmedPhotoURL)) {
            await appAlert('Use a valid image URL (http/https) or upload an image.', { title: 'Invalid Photo URL', danger: true });
            return;
        }

        setGroupSettingsSaving(true);
        try {
            await updateDoc(doc(db, 'dms', groupSettingsDm.id), {
                name: trimmedName,
                photoURL: trimmedPhotoURL || '',
                ownerId: groupSettingsOwnerId || currentUser.uid,
                updatedAt: serverTimestamp(),
            });

            if (activeChannelId === groupSettingsDm.id) {
                setActiveChannelName(trimmedName);
            }
        } catch (error) {
            if (import.meta.env.DEV) console.error('Error updating group chat:', error);
            await appAlert('Failed to update group chat.', { title: 'Update Failed', danger: true });
        } finally {
            setGroupSettingsSaving(false);
        }
    };

    const leaveGroupChat = async () => {
        if (!groupSettingsDm || groupSettingsLeaving) return;

        const participants = Array.isArray(groupSettingsDm.participants) ? groupSettingsDm.participants.filter(Boolean) : [];
        if (!participants.includes(currentUser.uid)) {
            closeGroupSettings(true);
            return;
        }

        const ownerLeavingWithOthers = groupSettingsOwnerId === currentUser.uid && participants.length > 1;
        const confirmed = await appConfirm(
            ownerLeavingWithOthers
                ? 'Leave this group? Ownership will transfer to another member.'
                : 'Leave this group chat?',
            { title: 'Leave Group Chat', confirmText: 'Leave', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;

        setGroupSettingsLeaving(true);
        try {
            const remainingParticipants = participants.filter((uid) => uid !== currentUser.uid);

            if (remainingParticipants.length === 0) {
                await deleteGroupMessages(groupSettingsDm.id);
                await deleteDoc(doc(db, 'dms', groupSettingsDm.id));
            } else {
                const payload = {
                    participants: remainingParticipants,
                    updatedAt: serverTimestamp(),
                };

                if (groupSettingsOwnerId === currentUser.uid) {
                    payload.ownerId = remainingParticipants[0];
                }

                await updateDoc(doc(db, 'dms', groupSettingsDm.id), payload);
            }

            if (activeChannelId === groupSettingsDm.id) {
                switchToFriends();
            }
            closeGroupSettings(true);
        } catch (error) {
            if (import.meta.env.DEV) console.error('Error leaving group chat:', error);
            await appAlert('Failed to leave group chat.', { title: 'Leave Failed', danger: true });
        } finally {
            setGroupSettingsLeaving(false);
        }
    };

    const deleteGroupChat = async () => {
        if (!groupSettingsDm || !canManageCurrentGroup || groupSettingsDeleting) return;

        const confirmed = await appConfirm(
            'Delete this group chat for everyone? This cannot be undone.',
            { title: 'Delete Group Chat', confirmText: 'Delete', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;

        setGroupSettingsDeleting(true);
        try {
            await deleteGroupMessages(groupSettingsDm.id);
            await deleteDoc(doc(db, 'dms', groupSettingsDm.id));

            if (activeChannelId === groupSettingsDm.id) {
                switchToFriends();
            }
            closeGroupSettings(true);
        } catch (error) {
            if (import.meta.env.DEV) console.error('Error deleting group chat:', error);
            await appAlert('Failed to delete group chat.', { title: 'Delete Failed', danger: true });
        } finally {
            setGroupSettingsDeleting(false);
        }
    };

    const handleDeleteChannel = async (channel) => {
        const confirmed = await appConfirm(
            `Delete #${channel.name}? This can't be undone.`,
            { title: 'Delete Channel', confirmText: 'Delete', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;
        try {
            await updateDoc(doc(db, 'servers', activeServerId), { channels: arrayRemove(channel) });
            if (activeChannelId === `${activeServerId}-${channel.name}`) {
                setActiveChannelId(null); setActiveChannelName(null);
            }
        } catch (err) {
            if (import.meta.env.DEV) console.error('Error deleting channel:', err);
            await appAlert('Failed to delete channel.', { title: 'Delete Failed', danger: true });
        }
    };

    // Mark channel as read when activated
    useEffect(() => {
        if (activeChannelId) {
            setUnreadChannels(prev => ({ ...prev, [activeChannelId]: false }));
        }
    }, [activeChannelId]);

    const canManageChannels = hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.MANAGE_CHANNELS);

    useEffect(() => {
        if (activeServerId !== 'home' && showGroupCreator) {
            closeGroupCreator(true);
        }
    }, [activeServerId, showGroupCreator]);

    useEffect(() => {
        if (activeServerId !== 'home' && groupSettingsDmId) {
            closeGroupSettings(true);
        }
    }, [activeServerId, groupSettingsDmId]);

    useEffect(() => {
        if (!groupSettingsDmId) return;
        const stillExists = dms.some((dm) => dm.id === groupSettingsDmId);
        if (!stillExists) {
            closeGroupSettings(true);
        }
    }, [dms, groupSettingsDmId]);

    const shellStyle = {
        width: isMobileView ? '100%' : '240px',
        height: isMobileView ? '100%' : 'var(--app-vh)',
        background: 'linear-gradient(180deg, rgba(11,8,24,0.98) 0%, rgba(13,10,26,0.98) 100%)',
        display: 'flex', flexDirection: 'column',
        borderRight: isMobileView ? 'none' : '1px solid rgba(168,85,247,0.1)',
        position: 'relative',
        overflow: 'visible',
        zIndex: 150,
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
                            onClick={() => {
                                setActiveChannelId('friends');
                                setActiveChannelName('Friends');
                                if (setActiveChannelType) setActiveChannelType('friends');
                                if (setActiveDmUser) setActiveDmUser(null);
                            }}
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <motion.button
                                className="glossy-button" whileTap={{ scale: 0.97 }}
                                style={{ width: '100%', fontSize: '13px', padding: '9px 12px', borderRadius: '10px' }}
                                onClick={() => setShowDmSearch(!showDmSearch)}
                            >
                                {showDmSearch ? 'Close' : 'Start DM'}
                            </motion.button>
                            <motion.button
                                className="secondary-button"
                                whileTap={{ scale: 0.97 }}
                                style={{ width: '100%', fontSize: '13px', padding: '9px 12px', borderRadius: '10px' }}
                                onClick={openGroupCreator}
                            >
                                Group Chat
                            </motion.button>
                        </div>
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
                                                <div style={{ marginRight: '10px' }}>
                                                    <AvatarBubble photoURL={user.photoURL} displayName={user.displayName} size={28} fallbackBorder="1px solid rgba(168,85,247,0.2)" />
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
                            <DMItem key={dm.id} index={index} dm={dm} active={activeChannelId === dm.id}
                                onOpenGroupSettings={openGroupSettings}
                                onClick={() => {
                                    setActiveChannelId(dm.id);
                                    setActiveChannelName(dm.displayName);
                                    if (setActiveChannelType) setActiveChannelType(dm.kind === 'group' ? 'group-dm' : 'dm');
                                    if (setActiveDmUser) setActiveDmUser(dm.kind === 'group' ? null : (dm.otherUser || null));
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                <UserArea currentUser={currentUser} userRoleColor={userRoleColor} onSettings={() => setIsSettingsOpen(true)} />
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
                {showGroupCreator && createPortal(
                    <GroupChatCreatorModal
                        isOpen={showGroupCreator}
                        onClose={closeGroupCreator}
                        candidates={groupCandidates}
                        selectedIds={groupSelectedIds}
                        onToggleMember={toggleGroupMember}
                        groupName={groupNameInput}
                        setGroupName={setGroupNameInput}
                        searchQuery={groupSearchQuery}
                        setSearchQuery={setGroupSearchQuery}
                        onCreate={createGroupChat}
                        loading={groupCandidatesLoading}
                        creating={groupCreating}
                    />,
                    document.body
                )}
                {groupSettingsDm && createPortal(
                    <GroupChatSettingsModal
                        isOpen={!!groupSettingsDm}
                        onClose={closeGroupSettings}
                        dm={groupSettingsDm}
                        isOwner={canManageCurrentGroup}
                        onSave={saveGroupSettings}
                        onLeave={leaveGroupChat}
                        onDelete={deleteGroupChat}
                        saving={groupSettingsSaving}
                        leaving={groupSettingsLeaving}
                        deleting={groupSettingsDeleting}
                    />,
                    document.body
                )}
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
            <div ref={serverMenuRef} style={{ position: 'relative', zIndex: 400 }}>
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
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute', top: '100%', left: '8px', right: '8px',
                                zIndex: 1400,
                                background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                                border: '1px solid rgba(168,85,247,0.22)',
                                borderRadius: '12px', padding: '6px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}
                        >
                            <motion.div
                                whileHover={{ backgroundColor: 'rgba(168,85,247,0.12)' }}
                                onClick={(e) => { e.stopPropagation(); setShowServerMenu(false); setShowInvite(true); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', color: '#c084fc', transition: 'background-color 0.1s' }}
                            >
                                <Link size={16} />
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>Invite People</span>
                            </motion.div>
                            <div style={{ height: '1px', background: 'rgba(168,85,247,0.1)', margin: '4px 0' }} />
                            <motion.div
                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                                onClick={(e) => { e.stopPropagation(); setShowServerMenu(false); setIsServerSettingsOpen(true); }}
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
                                                    if (setActiveChannelType) setActiveChannelType(channel.type || 'text');
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
            <ServerSettingsModal isOpen={isServerSettingsOpen} onClose={() => setIsServerSettingsOpen(false)} serverId={activeServerId} />
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
