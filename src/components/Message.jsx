import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit3, Trash2, Smile, Flag, Download, FileText } from 'lucide-react';

export default function Message({ message, currentUser, onEdit, onDelete, onReply, onReport, onViewProfile, onImageClick }) {
    const [showActions, setShowActions] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    const isOwnMessage = message.uid === currentUser.uid;

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                            cursor: 'pointer'
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
                marginTop: '8px'
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

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            style={{
                display: 'flex',
                gap: '16px',
                padding: '8px 16px',
                backgroundColor: showActions ? 'rgba(255,255,255,0.03)' : 'transparent',
                position: 'relative'
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
                    objectFit: 'cover'
                }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span
                        onClick={() => onViewProfile(message.uid, message.displayName, message.photoURL)}
                        style={{
                            fontWeight: 600,
                            color: message.uid === currentUser.uid ? 'var(--accent)' : 'white',
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
                </div>

                <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
                    {message.text}
                </div>

                {renderAttachment()}

                {message.gifUrl && (
                    <div style={{ marginTop: '8px' }}>
                        <img
                            src={message.gifUrl}
                            alt="GIF"
                            style={{
                                maxWidth: '100%',
                                borderRadius: '8px'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Actions */}
            {showActions && (
                <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '-10px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '4px',
                    display: 'flex',
                    gap: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="icon-btn" title="Add Reaction">
                        <Smile size={16} />
                    </button>
                    {isOwnMessage && (
                        <>
                            <button onClick={() => onEdit(message)} className="icon-btn" title="Edit">
                                <Edit3 size={16} />
                            </button>
                            <button onClick={() => onDelete(message.id)} className="icon-btn" title="Delete" style={{ color: 'var(--danger)' }}>
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                    {!isOwnMessage && (
                        <button onClick={() => onReport(message)} className="icon-btn" title="Report" style={{ color: 'var(--danger)' }}>
                            <Flag size={16} />
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
}
