import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import notificationSound from '../assets/sounds/notification.mp3';
import { createPortal } from 'react-dom';
import { Hash, Bell, Users, Search, Plus, Gift, Smile, Send, Menu, Edit3, X, Phone, Loader, Pin, Reply, Clock, ArrowUp, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import FileUpload from './FileUpload';
import MemberList from './MemberList';
import Message from './Message';
import CallModal from './CallModal';
import UserProfileModal from './UserProfileModal';
import TypingIndicator from './TypingIndicator';
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
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const [enlargedImage, setEnlargedImage] = useState(null);
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // New features state
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);

    // Slowmode state
    const [slowmodeSeconds, setSlowmodeSeconds] = useState(0);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const lastMessageTimeRef = useRef(0);

    const { currentUser } = useAuth();
    const { playNotification } = useSound();
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
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

    // Track scroll position for "scroll to bottom" button
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
            setShowScrollToBottom(!isNearBottom);
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Fetch pinned messages and channel settings (including slowmode)
    useEffect(() => {
        if (!activeChannelId) return;

        // Subscribe to channel settings changes
        const unsubscribe = onSnapshot(doc(db, "channelSettings", activeChannelId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPinnedMessages(data.pinnedMessages || []);
                setSlowmodeSeconds(data.slowmodeSeconds || 0);
            } else {
                setPinnedMessages([]);
                setSlowmodeSeconds(0);
            }
        });

        return unsubscribe;
    }, [activeChannelId]);

    // Slowmode cooldown timer
    useEffect(() => {
        if (cooldownRemaining <= 0) return;

        const timer = setInterval(() => {
            setCooldownRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldownRemaining]);

    // Filter messages based on search query
    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return messages;

        const query = searchQuery.toLowerCase();
        return messages.filter(msg =>
            msg.text?.toLowerCase().includes(query) ||
            msg.displayName?.toLowerCase().includes(query)
        );
    }, [messages, searchQuery]);

    // Get message by ID for reply previews
    const getMessageById = useCallback((messageId) => {
        return messages.find(msg => msg.id === messageId);
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
                    reader.onload = async (event) => {
                        const base64Data = event.target.result;

                        // Check for NSFW content
                        try {
                            const { loadImage, checkImage } = await import('../utils/imageFilter');
                            const img = await loadImage(base64Data);
                            const result = await checkImage(img);

                            if (result.isNSFW) {
                                alert(`Paste rejected: ${result.reason}`);
                                return;
                            }
                        } catch (filterError) {
                            console.error("Filter check failed:", filterError);
                        }

                        handleFileSelect({
                            name: "pasted-image.png",
                            type: file.type,
                            size: file.size,
                            data: base64Data,
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

        // Check slowmode cooldown (skip for editing)
        if (!editingMessage && slowmodeSeconds > 0 && cooldownRemaining > 0) {
            return;
        }

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
                // Build base message object
                const baseMessage = {
                    createdAt: serverTimestamp(),
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    photoURL: currentUser.photoURL,
                    channel: activeChannelId
                };

                // Add reply reference if replying
                if (replyingTo) {
                    baseMessage.replyTo = replyingTo.id;
                }

                // 1. Send Text Message (if exists)
                if (newMessage.trim()) {
                    await addDoc(collection(db, "messages"), {
                        ...baseMessage,
                        text: newMessage
                    });
                }

                // 2. Send Attachments (as separate messages for now)
                for (const attachment of pendingAttachments) {
                    await addDoc(collection(db, "messages"), {
                        ...baseMessage,
                        attachment: attachment
                    });
                }

                // Clear reply
                setReplyingTo(null);

                // Start slowmode cooldown
                if (slowmodeSeconds > 0) {
                    setCooldownRemaining(slowmodeSeconds);
                    lastMessageTimeRef.current = Date.now();
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

    // Handle pinning/unpinning messages
    const handlePinMessage = async (message) => {
        try {
            const channelRef = doc(db, "channelSettings", activeChannelId);
            const isPinned = pinnedMessages.includes(message.id);

            if (isPinned) {
                await setDoc(channelRef, {
                    pinnedMessages: arrayRemove(message.id)
                }, { merge: true });
            } else {
                await setDoc(channelRef, {
                    pinnedMessages: arrayUnion(message.id)
                }, { merge: true });
            }
        } catch (error) {
            console.error("Error pinning message:", error);
            alert("Failed to pin message");
        }
    };

    // Handle reply to message
    const handleReply = (message) => {
        setReplyingTo(message);
        inputRef.current?.focus();
    };

    const cancelReply = () => {
        setReplyingTo(null);
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

                <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    {/* Pinned Messages Button */}
                    {pinnedMessages.length > 0 && (
                        <button
                            className="icon-btn"
                            onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                            style={{
                                color: showPinnedMessages ? 'var(--accent)' : 'var(--text-secondary)',
                                position: 'relative'
                            }}
                            title={`${pinnedMessages.length} pinned message${pinnedMessages.length > 1 ? 's' : ''}`}
                        >
                            <Pin size={20} />
                            <span style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                backgroundColor: 'var(--accent)',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 700,
                                borderRadius: '50%',
                                width: '14px',
                                height: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {pinnedMessages.length}
                            </span>
                        </button>
                    )}

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

                    {/* Search Toggle */}
                    <button
                        className="icon-btn"
                        onClick={() => setShowSearchBar(!showSearchBar)}
                        style={{ color: showSearchBar ? 'var(--accent)' : 'var(--text-secondary)' }}
                        title="Search messages"
                    >
                        <Search size={20} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <AnimatePresence>
                {showSearchBar && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--glass-border)',
                            padding: '12px 16px',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <Search size={16} color="var(--text-muted)" />
                                <input
                                    type="text"
                                    placeholder="Search messages in this channel..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        flex: 1,
                                        background: 'none',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '14px',
                                        marginLeft: '8px',
                                        outline: 'none'
                                    }}
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: '2px'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {searchQuery && (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pinned Messages Panel */}
            <AnimatePresence>
                {showPinnedMessages && pinnedMessages.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--glass-border)',
                            maxHeight: '200px',
                            overflowY: 'auto'
                        }}
                    >
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Pin size={16} color="var(--accent)" />
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>Pinned Messages</span>
                            </div>
                            <button
                                onClick={() => setShowPinnedMessages(false)}
                                className="icon-btn"
                                style={{ padding: '4px' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {messages.filter(msg => pinnedMessages.includes(msg.id)).map(msg => (
                            <div
                                key={msg.id}
                                style={{
                                    padding: '8px 16px',
                                    borderBottom: '1px solid var(--glass-border)',
                                    cursor: 'pointer'
                                }}
                                className="hover:bg-white/5"
                                onClick={() => {
                                    // Scroll to message
                                    const element = document.getElementById(`msg-${msg.id}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        element.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                                        setTimeout(() => {
                                            element.style.backgroundColor = '';
                                        }, 2000);
                                    }
                                    setShowPinnedMessages(false);
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <img
                                        src={msg.photoURL}
                                        alt=""
                                        style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{msg.displayName}</span>
                                </div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {msg.text || (msg.attachment ? 'Attachment' : 'GIF')}
                                </p>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
                    {/* Messages */}
                    <div
                        ref={messagesContainerRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            paddingBottom: isMobile ? '100px' : '20px',
                            paddingTop: '10px'
                        }}
                    >
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
                            {filteredMessages.map((msg) => (
                                <div key={msg.id} id={`msg-${msg.id}`}>
                                    <Message
                                        message={msg}
                                        currentUser={currentUser}
                                        onEdit={setEditingMessage}
                                        onDelete={handleDeleteMessage}
                                        onReply={handleReply}
                                        onReport={handleReport}
                                        onViewProfile={(uid, displayName, photoURL) => setSelectedUserProfile({ uid, displayName, photoURL })}
                                        onImageClick={(url) => setEnlargedImage(url)}
                                        onPinMessage={handlePinMessage}
                                        isPinned={pinnedMessages.includes(msg.id)}
                                        replyToMessage={msg.replyTo ? getMessageById(msg.replyTo) : null}
                                    />
                                </div>
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll to Bottom Button */}
                    <AnimatePresence>
                        {showScrollToBottom && (
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                onClick={scrollToBottom}
                                style={{
                                    position: 'absolute',
                                    bottom: isMobile ? '180px' : '100px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    backgroundColor: 'var(--accent)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '20px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                    zIndex: 10
                                }}
                            >
                                <ArrowUp size={14} style={{ transform: 'rotate(180deg)' }} />
                                Jump to present
                            </motion.button>
                        )}
                    </AnimatePresence>
                    {/* Typing Indicator */}
                    <AnimatePresence>
                        {typingUsers.length > 0 && (
                            <TypingIndicator typingUsers={typingUsers} />
                        )}
                    </AnimatePresence>

                    <div style={{
                        padding: isMobile ? '12px' : '16px',
                        paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : '20px',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-primary)',
                        borderTop: isMobile ? '1px solid var(--glass-border)' : 'none',
                        zIndex: 10
                    }}>
                        {/* Slowmode Indicator */}
                        {slowmodeSeconds > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '6px 12px',
                                marginBottom: '8px',
                                backgroundColor: cooldownRemaining > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: cooldownRemaining > 0 ? 'var(--danger)' : 'var(--accent)'
                            }}>
                                <Clock size={14} />
                                {cooldownRemaining > 0 ? (
                                    <span>Slowmode enabled: Wait {cooldownRemaining}s before sending another message</span>
                                ) : (
                                    <span>Slowmode: {slowmodeSeconds}s between messages</span>
                                )}
                            </div>
                        )}

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

                        {/* Reply Indicator */}
                        {replyingTo && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    marginBottom: '8px',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    borderLeft: '3px solid var(--accent)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                    <Reply size={16} color="var(--accent)" />
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Replying to
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                                        {replyingTo.displayName}
                                    </span>
                                    <span style={{
                                        fontSize: '13px',
                                        color: 'var(--text-secondary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {replyingTo.text?.slice(0, 50) || (replyingTo.attachment ? 'Attachment' : 'GIF')}
                                        {replyingTo.text?.length > 50 ? '...' : ''}
                                    </span>
                                </div>
                                <button
                                    onClick={cancelReply}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </motion.div>
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
