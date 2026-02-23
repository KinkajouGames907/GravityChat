import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Trash2, Smile, Flag, Download, FileText, Reply, Pin, CornerUpRight, Copy, Check } from 'lucide-react';
import { useEmoji } from '../context/EmojiContext';
import { QUICK_REACTIONS } from '../utils/constants';
import userAvatar from '../assets/user_avatar.png';
import { resolveAvatarUrl } from '../utils/avatarUrl';

// Group threshold: 7 minutes
const GROUP_THRESHOLD_MS = 7 * 60 * 1000;

export default function Message({ message, prevMessage, currentUser, onEdit, onDelete, onReply, onReport, onViewProfile, onRightClickProfile, onImageClick, onReact, onPin, canModerate, onScrollToMessage }) {
    // Determine if this is a grouped (compact) message
    const isGrouped = (() => {
        if (!prevMessage || message.replyTo) return false;
        if (prevMessage.uid !== message.uid) return false;
        const prevTime = prevMessage.createdAt?.toDate ? prevMessage.createdAt.toDate() : new Date(prevMessage.createdAt || 0);
        const thisTime = message.createdAt?.toDate ? message.createdAt.toDate() : new Date(message.createdAt || 0);
        return (thisTime - prevTime) < GROUP_THRESHOLD_MS;
    })();
    const [showActions, setShowActions] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [revealedSpoilers, setRevealedSpoilers] = useState(new Set());
    const [copied, setCopied] = useState(false);
    const [avatarSrc, setAvatarSrc] = useState(() => resolveAvatarUrl(message.photoURL) || userAvatar);
    const { customEmojis } = useEmoji();

    useEffect(() => {
        setAvatarSrc(resolveAvatarUrl(message.photoURL) || userAvatar);
    }, [message.photoURL]);

    const isOwnMessage = message.uid === currentUser.uid;

    // Check if this message mentions the current user
    const isMentioned = message.text
        ? message.text.includes(`<@${currentUser.displayName}>`) || message.text.includes(`@everyone`)
        : false;

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `Today at ${time}`;
        if (isYesterday) return `Yesterday at ${time}`;
        return `${date.toLocaleDateString()} ${time}`;
    };

    const handleCopyText = () => {
        if (!message.text) return;
        // Convert <@Name> back to @Name for clipboard
        const plainText = message.text.replace(/<@([^>]+)>/g, '@$1');
        navigator.clipboard.writeText(plainText).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const revealSpoiler = (key) => {
        setRevealedSpoilers(prev => { const next = new Set(prev); next.add(key); return next; });
    };

    // ── Inline markdown renderer ──────────────────────────────────────────
    const renderInlineMarkdown = (text, keyPrefix = '') => {
        if (!text) return null;

        // 1. Split out inline code first
        const codeParts = text.split(/(`[^`]+`)/g);
        return codeParts.map((part, i) => {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
                return (
                    <code key={`${keyPrefix}-c${i}`} style={{
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        border: '1px solid rgba(168,85,247,0.15)',
                    }}>
                        {part.slice(1, -1)}
                    </code>
                );
            }

            // 2. Process bold/italic/strikethrough/underline/spoiler/mention
            const formattedParts = [];
            // Order matters: longer delimiters first
            const regex = /(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|~~.+?~~|__.+?__|<@[^>]+>|\|\|.+?\|\|)/gs;
            let lastIdx = 0;
            let m;

            while ((m = regex.exec(part)) !== null) {
                if (m.index > lastIdx) {
                    formattedParts.push(renderTextWithEmojisAndLinks(part.slice(lastIdx, m.index), `${keyPrefix}-${i}-${lastIdx}`));
                }
                const matched = m[0];
                const mKey = `${keyPrefix}-${i}-${m.index}`;

                if (matched.startsWith('***') && matched.endsWith('***')) {
                    formattedParts.push(<strong key={mKey}><em>{renderTextWithEmojisAndLinks(matched.slice(3, -3), mKey + 'bi')}</em></strong>);
                } else if (matched.startsWith('**') && matched.endsWith('**')) {
                    formattedParts.push(<strong key={mKey}>{renderTextWithEmojisAndLinks(matched.slice(2, -2), mKey + 'b')}</strong>);
                } else if (matched.startsWith('*') && matched.endsWith('*')) {
                    formattedParts.push(<em key={mKey}>{renderTextWithEmojisAndLinks(matched.slice(1, -1), mKey + 'i')}</em>);
                } else if (matched.startsWith('~~') && matched.endsWith('~~')) {
                    formattedParts.push(<del key={mKey}>{renderTextWithEmojisAndLinks(matched.slice(2, -2), mKey + 's')}</del>);
                } else if (matched.startsWith('__') && matched.endsWith('__')) {
                    formattedParts.push(<u key={mKey}>{renderTextWithEmojisAndLinks(matched.slice(2, -2), mKey + 'u')}</u>);
                } else if (matched.startsWith('||') && matched.endsWith('||')) {
                    const spoilerKey = mKey + 'sp';
                    const revealed = revealedSpoilers.has(spoilerKey);
                    const inner = matched.slice(2, -2);
                    formattedParts.push(
                        <span
                            key={spoilerKey}
                            onClick={() => !revealed && revealSpoiler(spoilerKey)}
                            title={revealed ? '' : 'Click to reveal spoiler'}
                            style={{
                                backgroundColor: revealed ? 'rgba(168,85,247,0.15)' : 'rgba(50,40,70,0.95)',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                cursor: revealed ? 'text' : 'pointer',
                                color: revealed ? 'var(--text-primary)' : 'transparent',
                                userSelect: revealed ? 'text' : 'none',
                                transition: 'all 0.25s ease',
                                display: 'inline',
                                fontStyle: 'normal',
                            }}
                        >
                            {inner}
                        </span>
                    );
                } else if (matched.startsWith('<@') && matched.endsWith('>')) {
                    const mentionName = matched.slice(2, -1);
                    const isSelf = mentionName === currentUser.displayName || mentionName === 'everyone';
                    formattedParts.push(
                        <span key={mKey} style={{
                            color: '#c084fc',
                            backgroundColor: isSelf ? 'rgba(168,85,247,0.22)' : 'rgba(168,85,247,0.1)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            cursor: 'default',
                        }}>
                            @{mentionName}
                        </span>
                    );
                }

                lastIdx = m.index + m[0].length;
            }

            if (lastIdx < part.length) {
                formattedParts.push(renderTextWithEmojisAndLinks(part.slice(lastIdx), `${keyPrefix}-${i}-end`));
            }
            if (formattedParts.length === 0) {
                formattedParts.push(renderTextWithEmojisAndLinks(part, `${keyPrefix}-${i}-all`));
            }
            return <span key={`${keyPrefix}-${i}`}>{formattedParts}</span>;
        });
    };

    // ── URL + Custom emoji renderer ───────────────────────────────────────
    const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i;
    const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

    const renderTextWithEmojisAndLinks = (text, keyPrefix = '') => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        const parts = text.split(urlRegex);

        return parts.map((part, index) => {
            if (urlRegex.test(part)) {
                urlRegex.lastIndex = 0;
                const cleanUrl = part.split('?')[0];
                const isImageUrl = IMAGE_EXT_RE.test(cleanUrl);
                const ytMatch = part.match(YT_RE);

                if (ytMatch) {
                    const videoId = ytMatch[1];
                    return (
                        <div key={`${keyPrefix}-${index}`} style={{ marginTop: '6px', maxWidth: '420px' }}>
                            <a href={part} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px', fontSize: '14px' }}
                                onClick={(e) => e.stopPropagation()}>{part}</a>
                            <a href={part} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'block', marginTop: '6px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(168,85,247,0.2)', textDecoration: 'none' }}>
                                <div style={{ position: 'relative' }}>
                                    <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                        alt="YouTube thumbnail"
                                        style={{ width: '100%', display: 'block', maxHeight: '220px', objectFit: 'cover' }}
                                        onError={(e) => { e.target.parentElement.parentElement.style.display = 'none'; }}
                                    />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                                            <span style={{ fontSize: '22px', marginLeft: '4px' }}>▶</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '10px 14px', background: 'rgba(6,4,15,0.9)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>▶ YouTube</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>youtu.be/{videoId}</span>
                                </div>
                            </a>
                        </div>
                    );
                }

                return (
                    <span key={`${keyPrefix}-${index}`} style={{ display: isImageUrl ? 'block' : 'inline' }}>
                        <a href={part} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                        {isImageUrl && (
                            <div style={{ marginTop: '6px' }}>
                                <img
                                    src={part} alt="Embedded image"
                                    onClick={() => onImageClick && onImageClick(part)}
                                    style={{ maxWidth: '400px', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', display: 'block', border: '1px solid rgba(168,85,247,0.15)' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        )}
                    </span>
                );
            }
            urlRegex.lastIndex = 0;

            const emojiParts = part.split(/(:[a-zA-Z0-9_]+:)/g);
            return emojiParts.map((ePart, eIdx) => {
                if (customEmojis[ePart]) {
                    return (
                        <img key={`${keyPrefix}-${index}-${eIdx}`} src={customEmojis[ePart]} alt={ePart} title={ePart}
                            style={{ width: '24px', height: '24px', verticalAlign: 'middle', margin: '0 2px', objectFit: 'contain' }}
                        />
                    );
                }
                return ePart;
            });
        });
    };

    // ── Full message text renderer (handles code blocks first) ────────────
    const renderMarkdown = (text) => {
        if (!text) return null;
        const segments = [];
        const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
            }
            segments.push({ type: 'codeblock', lang: match[1] || '', content: match[2] });
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            segments.push({ type: 'text', content: text.slice(lastIndex) });
        }

        return segments.map((seg, i) => {
            if (seg.type === 'codeblock') {
                return (
                    <pre key={i} style={{
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                        margin: '6px 0',
                        border: '1px solid rgba(168,85,247,0.15)',
                        lineHeight: 1.5,
                    }}>
                        {seg.lang && (
                            <div style={{ fontSize: '11px', color: 'rgba(168,85,247,0.6)', marginBottom: '6px', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {seg.lang}
                            </div>
                        )}
                        <code style={{ color: '#e2d9f3' }}>{seg.content.trim()}</code>
                    </pre>
                );
            }
            return <span key={i}>{renderInlineMarkdown(seg.content, String(i))}</span>;
        });
    };

    // ── Attachment renderer ───────────────────────────────────────────────
    const renderAttachment = () => {
        if (!message.attachment) return null;
        const { type, name, data, size } = message.attachment;
        if (message.attachment.isImage) {
            return (
                <div style={{ marginTop: '8px' }}>
                    <img src={data} alt={name}
                        onClick={() => onImageClick && onImageClick(data)}
                        style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                </div>
            );
        }
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginTop: '8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                <FileText size={24} color="var(--accent)" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(size / 1024).toFixed(1)} KB</div>
                </div>
                <a href={data} download={name} style={{ color: 'var(--text-secondary)' }}><Download size={20} /></a>
            </div>
        );
    };

    // ── Reaction counts ───────────────────────────────────────────────────
    const reactionCounts = {};
    if (message.reactions) {
        Object.entries(message.reactions).forEach(([userId, emojis]) => {
            (Array.isArray(emojis) ? emojis : [emojis]).forEach(emoji => {
                if (!reactionCounts[emoji]) reactionCounts[emoji] = { count: 0, users: [], hasReacted: false };
                reactionCounts[emoji].count++;
                reactionCounts[emoji].users.push(userId);
                if (userId === currentUser.uid) reactionCounts[emoji].hasReacted = true;
            });
        });
    }

    return (
        <motion.div
            layout
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => { setShowActions(false); setShowReactionPicker(false); }}
            style={{
                display: 'flex',
                gap: '16px',
                padding: isGrouped ? '2px 16px' : '8px 16px',
                paddingTop: isGrouped ? '2px' : '8px',
                backgroundColor: isMentioned
                    ? 'rgba(168,85,247,0.07)'
                    : showActions ? 'rgba(255,255,255,0.025)' : (message.pinned ? 'rgba(250,204,21,0.04)' : 'transparent'),
                position: 'relative',
                borderLeft: isMentioned
                    ? '3px solid rgba(168,85,247,0.5)'
                    : message.pinned ? '3px solid #facc15' : '3px solid transparent',
                transition: 'background-color 0.15s',
            }}
        >
            {/* Avatar column — hidden in grouped mode, replaced by timestamp hover */}
            {isGrouped ? (
                <div style={{ width: '40px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: '2px' }}>
                    <AnimatePresence>
                        {showActions && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', lineHeight: '22px' }}
                            >
                                {message.createdAt ? new Date(message.createdAt.toDate ? message.createdAt.toDate() : message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <img
                    src={avatarSrc}
                    alt={message.displayName}
                    referrerPolicy="no-referrer"
                    onClick={() => onViewProfile(message.uid, message.displayName, message.photoURL)}
                    onContextMenu={(e) => {
                        if (onRightClickProfile) {
                            e.preventDefault();
                            onRightClickProfile(message.uid);
                        }
                    }}
                    onError={() => {
                        if (avatarSrc !== userAvatar) {
                            setAvatarSrc(userAvatar);
                        }
                    }}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', objectFit: 'cover', flexShrink: 0 }}
                    title={message.uid === currentUser.uid ? "Left click: View Profile | Right click: Edit Profile" : "View Profile"}
                />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Reply reference */}
                {message.replyTo && (
                    <div
                        onClick={() => onScrollToMessage && onScrollToMessage(message.replyTo.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px',
                            cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                        }}
                    >
                        <CornerUpRight size={12} />
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{message.replyTo.displayName}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {message.replyTo.text || 'Click to see attachment'}
                        </span>
                    </div>
                )}

                {/* Author + timestamp (hidden in grouped mode) */}
                {!isGrouped && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span
                            onClick={() => onViewProfile(message.uid, message.displayName, message.photoURL)}
                            onContextMenu={(e) => {
                                if (onRightClickProfile) {
                                    e.preventDefault();
                                    onRightClickProfile(message.uid);
                                }
                            }}
                            style={{ fontWeight: 700, color: isOwnMessage ? '#c084fc' : 'var(--text-primary)', cursor: 'pointer', fontSize: '14px' }}
                            title={isOwnMessage ? "Left click: View Profile | Right click: Edit Profile" : "View Profile"}
                        >
                            {message.displayName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatTime(message.createdAt)}</span>
                        {message.edited && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>(edited)</span>}
                        {message.pinned && (
                            <span style={{ fontSize: '10px', color: '#facc15', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Pin size={10} /> pinned
                            </span>
                        )}
                    </div>
                )}

                {/* Message body */}
                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.55', fontSize: '14.5px' }}>
                    {renderMarkdown(message.text)}
                </div>

                {renderAttachment()}

                {message.gifUrl && (
                    <div style={{ marginTop: '8px' }}>
                        <img src={message.gifUrl} alt="GIF"
                            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', display: 'block' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                )}

                {/* Reactions */}
                {Object.keys(reactionCounts).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {Object.entries(reactionCounts).map(([emoji, data]) => (
                            <motion.button
                                key={emoji}
                                whileHover={{ scale: 1.1, y: -1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onReact && onReact(message.id, emoji)}
                                title={data.hasReacted ? `You reacted • ${data.count} total` : `${data.count} reaction${data.count !== 1 ? 's' : ''}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '3px 9px', borderRadius: '12px',
                                    border: data.hasReacted ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(255,255,255,0.08)',
                                    backgroundColor: data.hasReacted ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)',
                                    cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {emoji}
                                <span style={{ fontSize: '12px', fontWeight: 700, color: data.hasReacted ? '#c084fc' : 'var(--text-secondary)' }}>
                                    {data.count}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            {/* Action toolbar */}
            <AnimatePresence>
                {showActions && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute', right: '16px', top: '-14px',
                            backgroundColor: 'rgba(11,8,24,0.97)',
                            border: '1px solid rgba(168,85,247,0.2)',
                            borderRadius: '10px', padding: '4px 6px',
                            display: 'flex', gap: '2px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(168,85,247,0.05)',
                            zIndex: 10,
                        }}
                    >
                        {/* Emoji react */}
                        <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="icon-btn" title="Add reaction" style={{ borderRadius: '6px' }}>
                            <Smile size={16} />
                        </button>
                        {/* Reply */}
                        <button onClick={() => onReply(message)} className="icon-btn" title="Reply">
                            <Reply size={16} />
                        </button>
                        {/* Copy text */}
                        {message.text && (
                            <button onClick={handleCopyText} className="icon-btn" title="Copy text"
                                style={{ color: copied ? '#4ade80' : undefined }}>
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        )}
                        {/* Pin */}
                        {(canModerate || isOwnMessage) && onPin && (
                            <button onClick={() => onPin(message.id, !message.pinned)} className="icon-btn"
                                title={message.pinned ? 'Unpin' : 'Pin message'}>
                                <Pin size={16} style={{ color: message.pinned ? '#facc15' : undefined }} />
                            </button>
                        )}
                        {/* Edit (own only) */}
                        {isOwnMessage && (
                            <button onClick={() => onEdit(message)} className="icon-btn" title="Edit message">
                                <Edit3 size={16} />
                            </button>
                        )}
                        {/* Delete */}
                        {(isOwnMessage || canModerate) && (
                            <button onClick={() => onDelete(message.id)} className="icon-btn"
                                title={isOwnMessage ? 'Delete message' : 'Delete (mod)'}
                                style={{ color: 'var(--danger)' }}>
                                <Trash2 size={16} />
                            </button>
                        )}
                        {/* Report (others' messages only) */}
                        {!isOwnMessage && (
                            <button onClick={() => onReport(message)} className="icon-btn" title="Report message"
                                style={{ color: 'var(--danger)' }}>
                                <Flag size={16} />
                            </button>
                        )}

                        {/* Quick reaction picker */}
                        <AnimatePresence>
                            {showReactionPicker && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.92 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.92 }}
                                    transition={{ duration: 0.15 }}
                                    style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                                        backgroundColor: 'rgba(11,8,24,0.97)',
                                        border: '1px solid rgba(168,85,247,0.2)',
                                        borderRadius: '10px', padding: '8px 10px',
                                        display: 'flex', gap: '4px',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        zIndex: 20,
                                    }}
                                >
                                    {QUICK_REACTIONS.map(emoji => (
                                        <motion.button
                                            key={emoji}
                                            whileHover={{ scale: 1.3, y: -3 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => { onReact && onReact(message.id, emoji); setShowReactionPicker(false); }}
                                            style={{
                                                background: 'none', border: 'none',
                                                fontSize: '20px', cursor: 'pointer',
                                                padding: '4px 5px', borderRadius: '6px',
                                                transition: 'background-color 0.1s',
                                            }}
                                            className="hover:bg-white/10"
                                        >
                                            {emoji}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
