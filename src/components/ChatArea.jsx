import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Bell, Users, Search, Plus, Gift, Smile, Send, Menu, Edit3, Trash2, MoreHorizontal, Mic, X, Image as ImageIcon, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import MemberList from './MemberList';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import FileUpload from './FileUpload';

import userAvatar from '../assets/user_avatar.png';

// Emoji reactions list
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👎', '🎉'];

const Message = ({
    message,
    isOwn,
    isMobile,
    onReaction,
    onEdit,
    onDelete,
    currentUser,
    showActions
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
                setShowReactions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatTime = (timestamp) => {
        if (!timestamp?.toDate) return 'Sending...';
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageContent = () => {
        // Check if message is an image/GIF
        if (message.attachment?.isImage) {
            return (
                <div style={{ marginTop: '8px' }}>
                    <img
                        src={message.attachment.data}
                        alt={message.attachment.name}
                        style={{
                            maxWidth: isMobile ? '200px' : '400px',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                        onClick={() => window.open(message.attachment.data, '_blank')}
                    />
                </div>
            );
        }

        // Check if message is a GIF URL
        if (message.gifUrl) {
            return (
                <div style={{ marginTop: '8px' }}>
                    <img
                        src={message.gifUrl}
                        alt="GIF"
                        style={{
                            maxWidth: isMobile ? '200px' : '300px',
                            borderRadius: '8px'
                        }}
                    />
                </div>
            );
        }

        // Check if message is a text file
        if (message.attachment && !message.attachment.isImage) {
            return (
                <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FileText size={24} color="var(--accent)" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{message.attachment.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {(message.attachment.size / 1024).toFixed(1)} KB
                        </div>
                    </div>
                    <a
                        href={message.attachment.data}
                        download={message.attachment.name}
                        style={{ color: 'var(--accent)' }}
                    >
                        <Download size={20} />
                    </a>
                </div>
            );
        }

        // Regular text message
        if (message.text) {
            return (
                <p style={{
                    margin: '2px 0 0',
                    fontSize: isMobile ? '14px' : '16px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}>
                    {message.text}
                    {message.edited && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            (edited)
                        </span>
                    )}
                </p>
            );
        }

        return null;
    };

    const reactions = message.reactions || {};
    const hasReactions = Object.keys(reactions).length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            layout
            style={{
                display: 'flex',
                gap: isMobile ? '10px' : '16px',
                padding: isMobile ? '8px 12px' : '10px 16px',
                marginTop: '4px',
                backgroundColor: isOwn ? 'rgba(29, 155, 240, 0.05)' : 'transparent',
                borderLeft: isOwn ? '3px solid var(--accent)' : '3px solid transparent',
                borderRadius: '0 8px 8px 0',
                position: 'relative',
                transition: 'background-color 0.15s'
            }}
            onMouseEnter={() => showActions && setShowMenu(true)}
            onMouseLeave={() => { setShowMenu(false); setShowReactions(false); }}
        >
            {/* Avatar */}
            <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '50%',
                backgroundColor: message.photoURL ? 'transparent' : 'var(--bg-tertiary)',
                backgroundImage: `url(${message.photoURL || userAvatar})`,
                backgroundSize: 'cover',
                flexShrink: 0
            }} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{
                        fontWeight: 600,
                        fontSize: isMobile ? '14px' : '15px',
                        color: isOwn ? 'var(--accent)' : 'var(--text-primary)'
                    }}>
                        {message.displayName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatTime(message.createdAt)}
                    </span>
                </div>

                {renderMessageContent()}

                {/* Reactions Display */}
                {hasReactions && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginTop: '8px'
                    }}>
                        {Object.entries(reactions).map(([emoji, users]) => (
                            <motion.button
                                key={emoji}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onReaction(message.id, emoji)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    backgroundColor: users.includes(currentUser?.uid)
                                        ? 'var(--accent-dim)'
                                        : 'var(--bg-tertiary)',
                                    border: users.includes(currentUser?.uid)
                                        ? '1px solid var(--accent)'
                                        : '1px solid transparent',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                <span>{emoji}</span>
                                <span style={{
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600
                                }}>
                                    {users.length}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            {/* Action Buttons (on hover) */}
            <AnimatePresence>
                {showMenu && !isMobile && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: 'absolute',
                            top: '-16px',
                            right: '16px',
                            display: 'flex',
                            gap: '2px',
                            padding: '4px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            zIndex: 10
                        }}
                    >
                        {/* Emoji Reaction Button */}
                        <button
                            onClick={() => setShowReactions(!showReactions)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '6px 8px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Add reaction"
                        >
                            <Smile size={18} />
                        </button>

                        {/* Edit Button (own messages only) */}
                        {isOwn && message.text && (
                            <button
                                onClick={() => onEdit(message)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Edit message"
                            >
                                <Edit3 size={18} />
                            </button>
                        )}

                        {/* Delete Button (own messages only) */}
                        {isOwn && (
                            <button
                                onClick={() => onDelete(message.id)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    color: 'var(--danger)',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Delete message"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}

                        {/* Quick Reactions Popup */}
                        <AnimatePresence>
                            {showReactions && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        display: 'flex',
                                        gap: '4px',
                                        padding: '8px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '24px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    {QUICK_REACTIONS.map(emoji => (
                                        <motion.button
                                            key={emoji}
                                            whileHover={{ scale: 1.2 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => {
                                                onReaction(message.id, emoji);
                                                setShowReactions(false);
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                fontSize: '20px',
                                                cursor: 'pointer',
                                                padding: '4px'
                                            }}
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
};

// Typing Indicator Component
const TypingIndicator = ({ typingUsers }) => {
    if (typingUsers.length === 0) return null;

    const text = typingUsers.length === 1
        ? `${typingUsers[0]} is typing...`
        : typingUsers.length === 2
            ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
            : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
                padding: '8px 16px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            <div style={{ display: 'flex', gap: '3px' }}>
                {[0, 1, 2].map(i => (
                    <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.1
                        }}
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--text-muted)'
                        }}
                    />
                ))}
            </div>
            {text}
        </motion.div>
    );
};

export default function ChatArea({ activeChannelId, activeChannelName, activeServerId, isMobile, onOpenMenu }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showMemberList, setShowMemberList] = useState(!isMobile);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const { currentUser } = useAuth();
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Request Notification Permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Fetch messages
    useEffect(() => {
        if (!activeChannelId) return;

        const q = query(
            collection(db, "messages"),
            where("channel", "==", activeChannelId),
            orderBy("createdAt")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const retentionLimit = new Date();
            retentionLimit.setMonth(retentionLimit.getMonth() - 4);

            const msgs = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(msg => {
                    if (!msg.createdAt) return true;
                    return msg.createdAt.toDate() > retentionLimit;
                });

            setMessages(msgs);
            scrollToBottom();

            // Notification Logic
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    const isRecent = msg.createdAt && (new Date() - msg.createdAt.toDate()) < 10000;

                    if (msg.uid !== currentUser.uid && document.hidden && isRecent) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            try {
                                new Notification(`New message in #${activeChannelName}`, {
                                    body: `${msg.displayName}: ${msg.text || 'Sent an attachment'}`,
                                    icon: '/favicon.ico'
                                });
                            } catch (e) {
                                console.error("Notification failed:", e);
                            }
                        }
                    }
                }
            });
        }, (error) => {
            console.error("Error fetching messages: ", error);
        });

        return unsubscribe;
    }, [activeChannelId, currentUser.uid, activeChannelName]);

    // Listen for typing indicators
    useEffect(() => {
        if (!activeChannelId) return;

        const typingRef = collection(db, "typing", activeChannelId, "users");
        const unsubscribe = onSnapshot(typingRef, (snapshot) => {
            const typing = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (doc.id !== currentUser.uid && data.timestamp) {
                    // Only show if typing within last 3 seconds
                    if (new Date() - data.timestamp.toDate() < 3000) {
                        typing.push(data.displayName);
                    }
                }
            });
            setTypingUsers(typing);
        });

        return unsubscribe;
    }, [activeChannelId, currentUser.uid]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    // Update typing status
    const updateTypingStatus = useCallback(async (isTyping) => {
        if (!activeChannelId) return;

        try {
            const typingRef = doc(db, "typing", activeChannelId, "users", currentUser.uid);
            if (isTyping) {
                await setDoc(typingRef, {
                    displayName: currentUser.displayName,
                    timestamp: serverTimestamp()
                });
            } else {
                await deleteDoc(typingRef);
            }
        } catch (e) {
            // Silently fail typing indicator
        }
    }, [activeChannelId, currentUser]);

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        // Update typing status
        updateTypingStatus(true);

        // Clear typing after 2 seconds of inactivity
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            updateTypingStatus(false);
        }, 2000);
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if ((!newMessage.trim() && !editingMessage) || !activeChannelId) return;

        // Clear typing status
        updateTypingStatus(false);

        if (editingMessage) {
            // Update existing message
            await updateDoc(doc(db, "messages", editingMessage.id), {
                text: newMessage,
                edited: true,
                editedAt: serverTimestamp()
            });
            setEditingMessage(null);
        } else {
            // Send new message
            await addDoc(collection(db, "messages"), {
                text: newMessage,
                createdAt: serverTimestamp(),
                uid: currentUser.uid,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                photoURL: currentUser.photoURL,
                channel: activeChannelId
            });
        }

        setNewMessage('');
        inputRef.current?.focus();
    };

    const handleEmojiSelect = (emoji) => {
        setNewMessage(prev => prev + emoji);
        inputRef.current?.focus();
    };

    const handleGifSelect = async (gifUrl) => {
        if (!activeChannelId) return;

        await addDoc(collection(db, "messages"), {
            gifUrl,
            createdAt: serverTimestamp(),
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            photoURL: currentUser.photoURL,
            channel: activeChannelId
        });

        setShowGifPicker(false);
    };

    const handleFileSelect = async (fileData) => {
        if (!activeChannelId) return;

        // Sanitize file data to ensure no invalid objects (like File objects) are passed
        const cleanAttachment = {
            name: String(fileData.name),
            type: String(fileData.type),
            size: Number(fileData.size),
            data: String(fileData.data),
            isImage: Boolean(fileData.isImage),
            isGif: Boolean(fileData.isGif)
        };

        await addDoc(collection(db, "messages"), {
            attachment: cleanAttachment,
            createdAt: serverTimestamp(),
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            photoURL: currentUser.photoURL,
            channel: activeChannelId
        });

        setShowFileUpload(false);
    };

    const handleReaction = async (messageId, emoji) => {
        const messageRef = doc(db, "messages", messageId);
        const message = messages.find(m => m.id === messageId);
        if (!message) return;

        const reactions = message.reactions || {};
        const users = reactions[emoji] || [];

        if (users.includes(currentUser.uid)) {
            // Remove reaction
            const newUsers = users.filter(id => id !== currentUser.uid);
            if (newUsers.length === 0) {
                delete reactions[emoji];
            } else {
                reactions[emoji] = newUsers;
            }
        } else {
            // Add reaction
            reactions[emoji] = [...users, currentUser.uid];
        }

        await updateDoc(messageRef, { reactions });
    };

    const handleEditMessage = (message) => {
        setEditingMessage(message);
        setNewMessage(message.text);
        inputRef.current?.focus();
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm('Delete this message?')) return;
        await deleteDoc(doc(db, "messages", messageId));
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setNewMessage('');
    };

    if (!activeChannelId) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-muted)',
                flexDirection: 'column',
                padding: '20px'
            }}>
                {isMobile && (
                    <button
                        onClick={onOpenMenu}
                        className="glossy-button"
                        style={{ marginBottom: '20px' }}
                    >
                        <Menu size={20} style={{ marginRight: '8px' }} /> Open Menu
                    </button>
                )}
                <h3 style={{ textAlign: 'center' }}>Select a channel to start chatting</h3>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            height: '100%',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                height: isMobile ? '52px' : '56px',
                padding: isMobile ? '0 12px' : '0 16px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--glass-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                flexShrink: 0,
                backgroundColor: 'var(--bg-secondary)',
                backdropFilter: 'blur(10px)'
            }}>
                {isMobile && (
                    <Menu
                        size={24}
                        color="var(--text-secondary)"
                        style={{ marginRight: '12px', cursor: 'pointer' }}
                        onClick={onOpenMenu}
                    />
                )}
                <Hash size={isMobile ? 20 : 24} color="var(--accent)" style={{ marginRight: '8px' }} />
                <h3 style={{
                    margin: 0,
                    fontSize: isMobile ? '16px' : '17px',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: isMobile ? '160px' : 'auto'
                }}>
                    {activeChannelName}
                </h3>
                {!isMobile && (
                    <>
                        <span style={{ margin: '0 12px', color: 'var(--text-muted)' }}>|</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>
                            Welcome to #{activeChannelName}
                        </span>
                    </>
                )}
                {isMobile && <div style={{ flex: 1 }} />}

                <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', color: 'var(--text-secondary)' }}>
                    {!isMobile && (
                        <button className="icon-btn" title="Notifications">
                            <Bell size={20} />
                        </button>
                    )}
                    {activeServerId !== 'home' && (
                        <button
                            className="icon-btn"
                            onClick={() => setShowMemberList(!showMemberList)}
                            style={{ color: showMemberList ? 'var(--accent)' : 'var(--text-secondary)' }}
                            title="Toggle members"
                        >
                            <Users size={20} />
                        </button>
                    )}
                    {!isMobile && (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search"
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 10px 6px 32px',
                                    color: 'white',
                                    width: '150px',
                                    fontSize: '13px'
                                }}
                            />
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Main Chat Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        paddingBottom: isMobile ? '100px' : '20px',
                        paddingTop: '10px'
                    }}>
                        {messages.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px 20px',
                                color: 'var(--text-muted)'
                            }}>
                                <Hash size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
                                    Welcome to #{activeChannelName}!
                                </h3>
                                <p>This is the start of the #{activeChannelName} channel.</p>
                            </div>
                        )}
                        <AnimatePresence>
                            {messages.map((msg) => (
                                <Message
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.uid === currentUser?.uid}
                                    isMobile={isMobile}
                                    currentUser={currentUser}
                                    onReaction={handleReaction}
                                    onEdit={handleEditMessage}
                                    onDelete={handleDeleteMessage}
                                    showActions={true}
                                />
                            ))}
                        </AnimatePresence>

                        {/* Typing Indicator */}
                        <AnimatePresence>
                            {typingUsers.length > 0 && (
                                <TypingIndicator typingUsers={typingUsers} />
                            )}
                        </AnimatePresence>

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{
                        padding: isMobile ? '12px' : '16px',
                        paddingBottom: isMobile ? 'calc(12px + var(--safe-area-bottom, 0px))' : '20px',
                        flexShrink: 0,
                        position: isMobile ? 'fixed' : 'relative',
                        bottom: isMobile ? '60px' : 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--bg-primary)',
                        borderTop: isMobile ? '1px solid var(--glass-border)' : 'none',
                        zIndex: 10
                    }}>
                        {/* Editing Indicator */}
                        {editingMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    marginBottom: '8px',
                                    backgroundColor: 'var(--accent-dim)',
                                    borderRadius: '8px',
                                    borderLeft: '3px solid var(--accent)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Edit3 size={16} color="var(--accent)" />
                                    <span style={{ fontSize: '13px', color: 'var(--accent)' }}>
                                        Editing message
                                    </span>
                                </div>
                                <button
                                    onClick={cancelEdit}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px'
                                    }}
                                >
                                    <X size={16} color="var(--text-muted)" />
                                </button>
                            </motion.div>
                        )}

                        <form
                            onSubmit={handleSendMessage}
                            style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '12px',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid var(--glass-border)',
                                position: 'relative'
                            }}
                        >
                            {/* Attachment Button */}
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setShowFileUpload(true)}
                                title="Upload file"
                            >
                                <Plus size={20} />
                            </button>

                            {/* Text Input */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={newMessage}
                                onChange={handleInputChange}
                                placeholder={editingMessage ? 'Edit your message...' : `Message #${activeChannelName}`}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: isMobile ? '16px' : '15px',
                                    padding: '10px 8px',
                                    outline: 'none'
                                }}
                            />

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
                                {/* GIF Button */}
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => {
                                        setShowGifPicker(!showGifPicker);
                                        setShowEmojiPicker(false);
                                    }}
                                    title="Send GIF"
                                    style={{ color: showGifPicker ? 'var(--accent)' : undefined }}
                                >
                                    <Gift size={20} />
                                </button>

                                {/* Emoji Button */}
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => {
                                        setShowEmojiPicker(!showEmojiPicker);
                                        setShowGifPicker(false);
                                    }}
                                    title="Add emoji"
                                    style={{ color: showEmojiPicker ? 'var(--accent)' : undefined }}
                                >
                                    <Smile size={20} />
                                </button>

                                {/* Send Button */}
                                {(newMessage.trim() || editingMessage) && (
                                    <motion.button
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        type="submit"
                                        className="icon-btn"
                                        style={{
                                            color: 'var(--accent)',
                                            backgroundColor: 'var(--accent-dim)'
                                        }}
                                    >
                                        <Send size={20} />
                                    </motion.button>
                                )}

                                {/* Emoji Picker */}
                                <EmojiPicker
                                    isOpen={showEmojiPicker}
                                    onClose={() => setShowEmojiPicker(false)}
                                    onEmojiSelect={handleEmojiSelect}
                                    position="top"
                                    isMobile={isMobile}
                                />

                                {/* GIF Picker */}
                                <GifPicker
                                    isOpen={showGifPicker}
                                    onClose={() => setShowGifPicker(false)}
                                    onGifSelect={handleGifSelect}
                                    position="top"
                                    isMobile={isMobile}
                                />
                            </div>
                        </form>
                    </div>
                </div>

                {/* Member List Sidebar */}
                <AnimatePresence>
                    {showMemberList && activeServerId !== 'home' && !isMobile && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '240px', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ height: '100%', overflow: 'hidden' }}
                        >
                            <MemberList serverId={activeServerId} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Member List Modal */}
                <AnimatePresence>
                    {showMemberList && activeServerId !== 'home' && isMobile && (
                        createPortal(
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                    backdropFilter: 'blur(4px)',
                                    zIndex: 2000,
                                    display: 'flex',
                                    justifyContent: 'flex-end'
                                }}
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) setShowMemberList(false);
                                }}
                            >
                                <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    style={{
                                        width: '80%',
                                        maxWidth: '300px',
                                        height: '100%',
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderLeft: '1px solid var(--glass-border)',
                                        boxShadow: '-5px 0 20px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{
                                            padding: '16px',
                                            borderBottom: '1px solid var(--glass-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <h3 style={{ margin: 0, fontSize: '16px' }}>Members</h3>
                                            <button
                                                onClick={() => setShowMemberList(false)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <MemberList serverId={activeServerId} />
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>,
                            document.body
                        )
                    )}
                </AnimatePresence>
            </div>

            {/* File Upload Modal */}
            <FileUpload
                isOpen={showFileUpload}
                onClose={() => setShowFileUpload(false)}
                onFileSelect={handleFileSelect}
            />
        </div>
    );
}
