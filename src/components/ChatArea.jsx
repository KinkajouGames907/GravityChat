import { useState, useEffect, useRef, useCallback } from 'react';
import notificationSound from '../assets/sounds/notification.mp3';
import { createPortal } from 'react-dom';
import { Hash, Bell, Users, Search, Plus, Gift, Smile, Send, Menu, Edit3, X, Phone, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import FileUpload from './FileUpload';
import MemberList from './MemberList';
import Message from './Message';
import CallModal from './CallModal';
import UserProfileModal from './UserProfileModal';
import { useSound } from '../context/SoundContext';

export default function ChatArea({ activeChannelId, activeChannelName, activeServerId, isMobile, onOpenMenu, activeDmUser }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [showMemberList, setShowMemberList] = useState(false);
    const [activeCall, setActiveCall] = useState(null);
    // activeDmUser is now passed as a prop
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const [enlargedImage, setEnlargedImage] = useState(null);
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const { currentUser } = useAuth();
    const { playNotification } = useSound();
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

            // Notification Logic
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    // Relaxed check: 30 seconds. If createdAt is null (local write), treat as recent.
                    const msgTime = msg.createdAt ? msg.createdAt.toDate() : new Date();
                    const isRecent = (new Date() - msgTime) < 30000;

                    if (msg.uid !== currentUser.uid && isRecent) {
                        // Play sound for all new messages from others
                        playNotification();

                        if (document.hidden) {
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

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        handleFileSelect({
                            name: "pasted-image.png",
                            type: file.type,
                            size: file.size,
                            data: event.target.result,
                            isImage: true,
                            isGif: false
                        });
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if ((!newMessage.trim() && pendingAttachments.length === 0 && !editingMessage) || !activeChannelId) return;

        // Clear typing status
        updateTypingStatus(false);
        setIsUploading(true);

        try {
            if (editingMessage) {
                // Update existing message
                await updateDoc(doc(db, "messages", editingMessage.id), {
                    text: newMessage,
                    edited: true,
                    editedAt: serverTimestamp()
                });
                setEditingMessage(null);
            } else {
                // 1. Send Text Message (if exists)
                if (newMessage.trim()) {
                    await addDoc(collection(db, "messages"), {
                        text: newMessage,
                        createdAt: serverTimestamp(),
                        uid: currentUser.uid,
                        displayName: currentUser.displayName || currentUser.email.split('@')[0],
                        photoURL: currentUser.photoURL,
                        channel: activeChannelId
                    });
                }

                // 2. Send Attachments (as separate messages for now)
                for (const attachment of pendingAttachments) {
                    await addDoc(collection(db, "messages"), {
                        attachment: attachment,
                        createdAt: serverTimestamp(),
                        uid: currentUser.uid,
                        displayName: currentUser.displayName || currentUser.email.split('@')[0],
                        photoURL: currentUser.photoURL,
                        channel: activeChannelId
                    });
                }
            }

            setNewMessage('');
            setPendingAttachments([]);
            inputRef.current?.focus();
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message.");
        } finally {
            setIsUploading(false);
        }
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

        setPendingAttachments(prev => [...prev, cleanAttachment]);
        setShowFileUpload(false);
    };

    const removeAttachment = (index) => {
        setPendingAttachments(prev => prev.filter((_, i) => i !== index));
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

    const handleReport = async (message) => {
        const reason = prompt("Why are you reporting this message?");
        if (!reason) return;

        try {
            await addDoc(collection(db, "reports"), {
                type: 'message',
                targetId: message.id,
                content: message.text || 'Attachment',
                reportedBy: currentUser.uid,
                reportedUser: message.uid,
                reason: reason,
                createdAt: serverTimestamp(),
                status: 'pending',
                channelId: activeChannelId,
                serverId: activeServerId
            });
            alert("Report submitted to moderators.");
        } catch (error) {
            console.error("Error submitting report:", error);
            alert("Failed to submit report.");
        }
    };

    const startCall = () => {
        if (!activeDmUser) return;
        setActiveCall({ isCaller: true, remoteUserId: activeDmUser.uid });
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
                backdropFilter: 'blur(10px)',
                zIndex: 20
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

                    {/* Call Button (only in DMs for now or if we want server calls) */}
                    {activeServerId === 'home' && (
                        <button
                            className="icon-btn"
                            onClick={startCall}
                            title="Start Call"
                        >
                            <Phone size={20} />
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

            {/* Call Modal */}
            {activeCall && (
                <CallModal
                    currentUser={currentUser}
                    isCaller={activeCall.isCaller}
                    remoteUserId={activeCall.remoteUserId}
                    onClose={() => setActiveCall(null)}
                />
            )}

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
                                    currentUser={currentUser}
                                    onEdit={setEditingMessage}
                                    onDelete={handleDeleteMessage}
                                    onReply={(msg) => setNewMessage(`Replying to: ${msg.text}\n`)}
                                    onReport={handleReport}
                                    onViewProfile={(uid, displayName, photoURL) => setSelectedUserProfile({ uid, displayName, photoURL })}
                                    onImageClick={(url) => setEnlargedImage(url)}
                                />
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>
                    <div style={{
                        padding: isMobile ? '12px' : '16px',
                        paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : '20px',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-primary)',
                        borderTop: isMobile ? '1px solid var(--glass-border)' : 'none',
                        zIndex: 10
                    }}>
                        {/* Staged Attachments */}
                        {pendingAttachments.length > 0 && (
                            <div style={{
                                display: 'flex',
                                gap: '10px',
                                padding: '10px',
                                overflowX: 'auto',
                                marginBottom: '10px',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                {pendingAttachments.map((att, index) => (
                                    <div key={index} style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                                        {att.isImage ? (
                                            <img src={att.data} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px', textAlign: 'center', padding: '4px' }}>
                                                {att.name}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => removeAttachment(index)}
                                            style={{
                                                position: 'absolute',
                                                top: '-5px',
                                                right: '-5px',
                                                backgroundColor: 'var(--error)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '20px',
                                                height: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

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
                            <textarea
                                ref={inputRef}
                                value={newMessage}
                                onChange={(e) => {
                                    handleInputChange(e);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                onPaste={handlePaste}
                                placeholder={editingMessage ? 'Edit your message...' : `Message #${activeChannelName}`}
                                rows={1}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: isMobile ? '16px' : '15px',
                                    padding: '10px 8px',
                                    outline: 'none',
                                    resize: 'none',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    fontFamily: 'inherit'
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
                                {(newMessage.trim() || editingMessage || pendingAttachments.length > 0) && (
                                    <motion.button
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        type="submit"
                                        className="icon-btn"
                                        style={{
                                            color: 'var(--accent)',
                                            backgroundColor: 'var(--accent-dim)'
                                        }}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
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

            <UserProfileModal
                isOpen={!!selectedUserProfile}
                onClose={() => setSelectedUserProfile(null)}
                user={selectedUserProfile}
                isMobile={isMobile}
            />

            {/* Image Lightbox */}
            <AnimatePresence>
                {enlargedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            zIndex: 3000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'zoom-out'
                        }}
                        onClick={() => setEnlargedImage(null)}
                    >
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            src={enlargedImage}
                            alt="Enlarged"
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '90vh',
                                objectFit: 'contain',
                                borderRadius: '8px',
                                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                            }}
                        />
                        <button
                            onClick={() => setEnlargedImage(null)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                backdropFilter: 'blur(4px)'
                            }}
                        >
                            <X size={24} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
