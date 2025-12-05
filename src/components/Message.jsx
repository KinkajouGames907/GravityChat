import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Trash2, Smile, Flag, Download, FileText, Reply, Pin, MoreHorizontal, Copy, Check } from 'lucide-react';
import { useEmoji } from '../context/EmojiContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

// Quick reaction emojis
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀'];

export default function Message({
    message,
    currentUser,
    onEdit,
    onDelete,
    onReply,
    onReport,
    onViewProfile,
    onImageClick,
    onPinMessage,
    isPinned,
    replyToMessage
}) {
    const [showActions, setShowActions] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const { customEmojis } = useEmoji();
    const moreMenuRef = useRef(null);
    const reactionPickerRef = useRef(null);

    const isOwnMessage = message.uid === currentUser.uid;

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
                setShowMoreMenu(false);
            }
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
                setShowReactionPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (daysDiff === 1) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (daysDiff < 7) {
            return `${date.toLocaleDateString([], { weekday: 'long' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handleReaction = async (emoji) => {
        try {
            const messageRef = doc(db, "messages", message.id);
            const currentReactions = message.reactions || {};
            const reactionUsers = currentReactions[emoji] || [];

            if (reactionUsers.includes(currentUser.uid)) {
                // Remove reaction
                await updateDoc(messageRef, {
                    [`reactions.${emoji}`]: arrayRemove(currentUser.uid)
                });
            } else {
                // Add reaction
                await updateDoc(messageRef, {
                    [`reactions.${emoji}`]: arrayUnion(currentUser.uid)
                });
            }
            setShowReactionPicker(false);
        } catch (error) {
            console.error("Error updating reaction:", error);
        }
    };

    const copyMessageText = () => {
        if (message.text) {
            navigator.clipboard.writeText(message.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        setShowMoreMenu(false);
    };

    const renderAttachment = () => {
        if (!message.attachment) return null;
        const { type, name, data, size } = message.attachment;

        if (message.attachment.isImage) {
            return (
                <div style={{ marginTop: '8px' }}>
                    <img
                        src={data}
                        alt={name}
                        onClick={() => onImageClick && onImageClick(data)}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                    />
                </div>
            );
        }

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                marginTop: '8px',
                border: '1px solid var(--glass-border)'
            }}>
                <FileText size={24} color="var(--accent)" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(size / 1024).toFixed(1)} KB</div>
                </div>
                <a href={data} download={name} style={{ color: 'var(--text-secondary)' }}>
                    <Download size={20} />
                </a>
            </div>
        );
    };

    // Render text with emojis, mentions, and basic markdown
    const renderTextWithFormatting = (text) => {
        if (!text) return null;

        // Process markdown: **bold**, *italic*, ~~strikethrough~~, `code`, ```code blocks```
        let processed = text;

        // Split by code blocks first to not process markdown inside them
        const parts = [];
        const codeBlockRegex = /```([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
            }
            parts.push({ type: 'codeblock', content: match[1] });
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }

        return parts.map((part, partIndex) => {
            if (part.type === 'codeblock') {
                return (
                    <pre key={partIndex} style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        margin: '8px 0',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <code>{part.content.trim()}</code>
                    </pre>
                );
            }

            // Process inline formatting
            let content = part.content;

            // Split by inline code
            const inlineCodeParts = content.split(/(`[^`]+`)/g);

            return inlineCodeParts.map((segment, segIndex) => {
                if (segment.startsWith('`') && segment.endsWith('`')) {
                    return (
                        <code key={`${partIndex}-${segIndex}`} style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.9em',
                            fontFamily: 'monospace'
                        }}>
                            {segment.slice(1, -1)}
                        </code>
                    );
                }

                // Process bold, italic, strikethrough
                const formattedSegment = segment
                    .split(/(\*\*[^*]+\*\*)/g)
                    .map((s, i) => {
                        if (s.startsWith('**') && s.endsWith('**')) {
                            return <strong key={i}>{s.slice(2, -2)}</strong>;
                        }
                        return s.split(/(\*[^*]+\*)/g).map((ss, ii) => {
                            if (ss.startsWith('*') && ss.endsWith('*') && !ss.startsWith('**')) {
                                return <em key={ii}>{ss.slice(1, -1)}</em>;
                            }
                            return ss.split(/(~~[^~]+~~)/g).map((sss, iii) => {
                                if (sss.startsWith('~~') && sss.endsWith('~~')) {
                                    return <del key={iii}>{sss.slice(2, -2)}</del>;
                                }
                                // Process custom emojis
                                return sss.split(/(:[a-zA-Z0-9_]+:)/g).map((part, pidx) => {
                                    if (customEmojis[part]) {
                                        return (
                                            <img
                                                key={pidx}
                                                src={customEmojis[part]}
                                                alt={part}
                                                title={part}
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    verticalAlign: 'middle',
                                                    margin: '0 2px',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        );
                                    }
                                    // Process mentions
                                    return part.split(/(@\w+)/g).map((mention, midx) => {
                                        if (mention.startsWith('@')) {
                                            return (
                                                <span
                                                    key={midx}
                                                    style={{
                                                        backgroundColor: 'var(--accent-dim)',
                                                        color: 'var(--accent)',
                                                        padding: '0 4px',
                                                        borderRadius: '4px',
                                                        fontWeight: 500,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {mention}
                                                </span>
                                            );
                                        }
                                        // Process URLs
                                        return part.split(/(https?:\/\/[^\s]+)/g).map((urlPart, uidx) => {
                                            if (urlPart.match(/^https?:\/\//)) {
                                                return (
                                                    <a
                                                        key={uidx}
                                                        href={urlPart}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--accent)' }}
                                                    >
                                                        {urlPart}
                                                    </a>
                                                );
                                            }
                                            return urlPart;
                                        });
                                    });
                                });
                            });
                        });
                    });

                return <span key={`${partIndex}-${segIndex}`}>{formattedSegment}</span>;
            });
        });
    };

    // Calculate total reactions count
    const reactions = message.reactions || {};
    const reactionEntries = Object.entries(reactions).filter(([_, users]) => users && users.length > 0);
    const hasReactions = reactionEntries.length > 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => {
                setShowActions(false);
                setShowMoreMenu(false);
            }}
            style={{
                display: 'flex',
                gap: '16px',
                padding: '8px 16px',
                backgroundColor: showActions ? 'rgba(255,255,255,0.03)' : (isPinned ? 'rgba(59, 130, 246, 0.05)' : 'transparent'),
                position: 'relative',
                borderLeft: isPinned ? '3px solid var(--accent)' : 'none',
                paddingLeft: isPinned ? '13px' : '16px'
            }}
        >
            <img
                src={message.photoURL}
                alt={message.displayName}
                onClick={() => onViewProfile(message.uid, message.displayName, message.photoURL)}
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    objectFit: 'cover',
                    flexShrink: 0
                }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Reply Preview */}
                {replyToMessage && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                        padding: '4px 8px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        borderLeft: '2px solid var(--accent)',
                        fontSize: '12px',
                        color: 'var(--text-muted)'
                    }}>
                        <Reply size={12} />
                        <img
                            src={replyToMessage.photoURL}
                            alt=""
                            style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {replyToMessage.displayName}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {replyToMessage.text || (replyToMessage.attachment ? 'Attachment' : 'GIF')}
                        </span>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span
                        onClick={() => onViewProfile(message.uid, message.displayName, message.photoURL)}
                        style={{
                            fontWeight: 600,
                            color: message.roleColor || (isOwnMessage ? 'var(--accent)' : 'white'),
                            cursor: 'pointer'
                        }}
                    >
                        {message.displayName}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatTime(message.createdAt)}
                    </span>
                    {message.edited && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(edited)</span>
                    )}
                    {isPinned && (
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                        }}>
                            <Pin size={10} /> Pinned
                        </span>
                    )}
                </div>

                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
                    {renderTextWithFormatting(message.text)}
                </div>

                {renderAttachment()}

                {message.gifUrl && (
                    <div style={{ marginTop: '8px' }}>
                        <img
                            src={message.gifUrl}
                            alt="GIF"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '250px',
                                borderRadius: '8px'
                            }}
                        />
                    </div>
                )}

                {/* Reactions Display */}
                {hasReactions && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginTop: '8px'
                    }}>
                        {reactionEntries.map(([emoji, users]) => (
                            <motion.button
                                key={emoji}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleReaction(emoji)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    border: users.includes(currentUser.uid)
                                        ? '1px solid var(--accent)'
                                        : '1px solid var(--glass-border)',
                                    backgroundColor: users.includes(currentUser.uid)
                                        ? 'var(--accent-dim)'
                                        : 'var(--bg-tertiary)',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                                title={`${users.length} reaction${users.length > 1 ? 's' : ''}`}
                            >
                                <span>{emoji}</span>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: users.includes(currentUser.uid) ? 'var(--accent)' : 'var(--text-secondary)'
                                }}>
                                    {users.length}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <AnimatePresence>
                {showActions && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute',
                            right: '16px',
                            top: '-10px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            padding: '4px',
                            display: 'flex',
                            gap: '2px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                    >
                        {/* Quick Reaction */}
                        <div style={{ position: 'relative' }} ref={reactionPickerRef}>
                            <button
                                onClick={() => setShowReactionPicker(!showReactionPicker)}
                                className="icon-btn"
                                title="Add Reaction"
                                style={{ padding: '6px' }}
                            >
                                <Smile size={16} />
                            </button>

                            {/* Reaction Picker */}
                            <AnimatePresence>
                                {showReactionPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: '4px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            padding: '8px',
                                            display: 'flex',
                                            gap: '4px',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                            zIndex: 100
                                        }}
                                    >
                                        {QUICK_REACTIONS.map(emoji => (
                                            <motion.button
                                                key={emoji}
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => handleReaction(emoji)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    fontSize: '20px',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    borderRadius: '4px'
                                                }}
                                            >
                                                {emoji}
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Reply Button */}
                        <button
                            onClick={() => onReply(message)}
                            className="icon-btn"
                            title="Reply"
                            style={{ padding: '6px' }}
                        >
                            <Reply size={16} />
                        </button>

                        {isOwnMessage && (
                            <>
                                <button
                                    onClick={() => onEdit(message)}
                                    className="icon-btn"
                                    title="Edit"
                                    style={{ padding: '6px' }}
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button
                                    onClick={() => onDelete(message.id)}
                                    className="icon-btn"
                                    title="Delete"
                                    style={{ color: 'var(--danger)', padding: '6px' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}

                        {/* More Menu */}
                        <div style={{ position: 'relative' }} ref={moreMenuRef}>
                            <button
                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                className="icon-btn"
                                title="More"
                                style={{ padding: '6px' }}
                            >
                                <MoreHorizontal size={16} />
                            </button>

                            <AnimatePresence>
                                {showMoreMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: '4px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            padding: '4px',
                                            minWidth: '150px',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                            zIndex: 100
                                        }}
                                    >
                                        <button
                                            onClick={copyMessageText}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                width: '100%',
                                                padding: '8px 12px',
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                            className="hover:bg-white/10"
                                        >
                                            {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                                            {copied ? 'Copied!' : 'Copy Text'}
                                        </button>

                                        {onPinMessage && (
                                            <button
                                                onClick={() => {
                                                    onPinMessage(message);
                                                    setShowMoreMenu(false);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: isPinned ? 'var(--accent)' : 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    fontSize: '14px'
                                                }}
                                                className="hover:bg-white/10"
                                            >
                                                <Pin size={16} />
                                                {isPinned ? 'Unpin Message' : 'Pin Message'}
                                            </button>
                                        )}

                                        {!isOwnMessage && (
                                            <button
                                                onClick={() => {
                                                    onReport(message);
                                                    setShowMoreMenu(false);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--danger)',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    fontSize: '14px'
                                                }}
                                                className="hover:bg-white/10"
                                            >
                                                <Flag size={16} />
                                                Report Message
                                            </button>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
