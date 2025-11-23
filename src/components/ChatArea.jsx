import { useState, useEffect, useRef } from 'react';
import { Hash, Bell, Users, Search, Plus, Gift, Smile, Sticker, Send, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import MemberList from './MemberList';

import userAvatar from '../assets/user_avatar.png';

const Message = ({ user, content, time, avatar, isOwn }) => (
    <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        layout
        style={{
            display: 'flex',
            gap: '16px',
            padding: '8px 16px',
            marginTop: '8px',
            group: 'message',
            backgroundColor: isOwn ? 'rgba(29, 155, 240, 0.05)' : 'transparent',
            borderLeft: isOwn ? '2px solid var(--accent)' : '2px solid transparent'
        }}
        className="hover:bg-white/5"
    >
        <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: avatar ? 'transparent' : 'var(--bg-tertiary)',
            backgroundImage: `url(${avatar || userAvatar})`,
            backgroundSize: 'cover',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'var(--text-secondary)'
        }}>
            {!avatar && !userAvatar && user[0].toUpperCase()}
        </div>
        <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: isOwn ? 'var(--accent)' : 'var(--text-primary)' }}>{user}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{time}</span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                {content}
            </p>
        </div>
    </motion.div>
);

export default function ChatArea({ activeChannelId, activeChannelName, activeServerId, isMobile, onOpenMenu }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showMemberList, setShowMemberList] = useState(true);
    const { currentUser } = useAuth();
    const messagesEndRef = useRef(null);

    // Request Notification Permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

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
                    if (!msg.createdAt) return true; // Keep pending messages
                    return msg.createdAt.toDate() > retentionLimit;
                });

            setMessages(msgs);
            scrollToBottom();

            // Notification Logic
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    // Only notify if:
                    // 1. It's not my own message
                    // 2. The document is hidden (user is away) OR on mobile (maybe app is in background, though browser support varies)
                    // 3. The message is recent (created in last 10 seconds) - prevents notification spam on load
                    const isRecent = msg.createdAt && (new Date() - msg.createdAt.toDate()) < 10000;

                    if (msg.uid !== currentUser.uid && document.hidden && isRecent) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            try {
                                new Notification(`New message in #${activeChannelName}`, {
                                    body: `${msg.displayName}: ${msg.text}`,
                                    icon: '/favicon.ico' // Optional
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChannelId) return;

        await addDoc(collection(db, "messages"), {
            text: newMessage,
            createdAt: serverTimestamp(),
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            photoURL: currentUser.photoURL,
            channel: activeChannelId
        });

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
                flexDirection: 'column'
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
                <h3>Select a channel to start chatting</h3>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            height: '100vh',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                height: '48px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--glass-border)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                flexShrink: 0
            }}>
                {isMobile && (
                    <Menu
                        size={24}
                        color="var(--text-secondary)"
                        style={{ marginRight: '16px', cursor: 'pointer' }}
                        onClick={onOpenMenu}
                    />
                )}
                <Hash size={24} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '120px' : 'auto' }}>{activeChannelName}</h3>
                {!isMobile && (
                    <>
                        <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>The start of something new.</span>
                    </>
                )}
                {isMobile && <div style={{ flex: 1 }} />}

                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                    {!isMobile && <Bell size={20} style={{ cursor: 'pointer' }} />}
                    <Users
                        size={20}
                        style={{ cursor: 'pointer', color: showMemberList ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        onClick={() => setShowMemberList(!showMemberList)}
                    />
                    {!isMobile && (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search"
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '4px 8px 4px 30px',
                                    color: 'white',
                                    width: '144px',
                                    fontSize: '13px'
                                }}
                            />
                            <Search size={14} style={{ position: 'absolute', left: '8px', top: '6px' }} />
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Main Chat Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                        <AnimatePresence>
                            {messages.map((msg) => (
                                <Message
                                    key={msg.id}
                                    user={msg.displayName}
                                    time={msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                                    content={msg.text}
                                    avatar={msg.photoURL}
                                    isOwn={msg.uid === currentUser?.uid}
                                />
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{ padding: '0 16px 24px', flexShrink: 0 }}>
                        <form
                            onSubmit={handleSendMessage}
                            style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '8px',
                                padding: '0 16px',
                                display: 'flex',
                                alignItems: 'center',
                                minHeight: '44px'
                            }}
                        >
                            <button type="button" className="icon-btn" style={{ marginLeft: '-8px' }}><Plus size={20} /></button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={`Message #${activeChannelName}`}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '15px',
                                    padding: '10px 0',
                                    outline: 'none'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginRight: '-8px' }}>
                                {!isMobile && (
                                    <>
                                        <button type="button" className="icon-btn"><Gift size={20} /></button>
                                        <button type="button" className="icon-btn"><Sticker size={20} /></button>
                                        <button type="button" className="icon-btn"><Smile size={20} /></button>
                                    </>
                                )}
                                {newMessage.trim() && (
                                    <button type="submit" className="icon-btn" style={{ color: 'var(--accent)' }}>
                                        <Send size={20} />
                                    </button>
                                )}
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
            </div>
        </div>
    );
}
