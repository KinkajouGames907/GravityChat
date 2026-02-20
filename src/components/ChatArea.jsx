import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import notificationSound from '../assets/sounds/notification.mp3';
import { createPortal } from 'react-dom';
import { Hash, Bell, Users, Search, Plus, Gift, Smile, Send, Menu, Edit3, X, Phone, Loader, Pin, Reply, CornerUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Particle burst when sending a message
const PARTICLE_COLORS = ['#a855f7', '#ec4899', '#f9a8d4', '#c084fc', '#ffffff', '#7c3aed', '#f0abfc'];

function SendParticles({ bursts }) {
    return createPortal(
        <>
            {bursts.map(({ id, cx, cy, particles }) =>
                particles.map((p, i) => (
                    <motion.div
                        key={`${id}-${i}`}
                        initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                        animate={{ x: p.dx, y: p.dy, scale: 0, opacity: 0 }}
                        transition={{ duration: p.dur, ease: 'easeOut' }}
                        style={{
                            position: 'fixed',
                            left: cx,
                            top: cy,
                            width: p.size,
                            height: p.size,
                            marginLeft: -p.size / 2,
                            marginTop: -p.size / 2,
                            borderRadius: '50%',
                            background: p.color,
                            pointerEvents: 'none',
                            zIndex: 9999,
                            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        }}
                    />
                ))
            )}
        </>,
        document.body
    );
}

function buildBurst(cx, cy) {
    const count = 18;
    const particles = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
        const dist = 35 + Math.random() * 90;
        return {
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist,
            color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
            size: 4 + Math.random() * 7,
            dur: 0.45 + Math.random() * 0.35,
        };
    });
    return { id: Date.now() + Math.random(), cx, cy, particles };
}
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import FileUpload from './FileUpload';
import MemberList from './MemberList';
import Message from './Message';
import CallModal from './CallModal';
import UserProfileModal from './UserProfileModal';
import ConfirmDialog from './ConfirmDialog';
import { useSound } from '../context/SoundContext';
import { hasPermission, PERMISSIONS, isSuperAdmin } from '../utils/permissions';
import { MAX_MESSAGE_LENGTH, MESSAGE_COOLDOWN_MS, TYPING_TIMEOUT_MS, TYPING_INDICATOR_TTL_MS, MESSAGE_RETENTION_MONTHS } from '../utils/constants';

export default function ChatArea({ activeChannelId, activeChannelName, activeServerId, isMobile, onOpenMenu, activeDmUser }) {
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(true);
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
    const [replyingTo, setReplyingTo] = useState(null);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [serverData, setServerData] = useState(null);
    const [currentUserMember, setCurrentUserMember] = useState(null);

    const [sendParticles, setSendParticles] = useState([]);
    const [sendRipple, setSendRipple] = useState(false);
    const sendBtnRef = useRef(null);

    // @mention autocomplete
    const [mentionQuery, setMentionQuery] = useState(null); // string after @, or null
    const [mentionResults, setMentionResults] = useState([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(-1); // cursor index of the @
    const [serverMembers, setServerMembers] = useState([]);

    // Slash command menu
    const [slashQuery, setSlashQuery] = useState(null);

    // Jump-to-bottom
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const { currentUser } = useAuth();
    const { playNotification } = useSound();
    const messagesEndRef = useRef(null);
    const messagesScrollRef = useRef(null);
    const messageRefs = useRef({});
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const lastMessageTimeRef = useRef(0);

    const fireSendBurst = useCallback(() => {
        if (!sendBtnRef.current) return;
        const rect = sendBtnRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const burst = buildBurst(cx, cy);
        setSendParticles(prev => [...prev, burst]);
        setSendRipple(true);
        setTimeout(() => setSendRipple(false), 500);
        setTimeout(() => {
            setSendParticles(prev => prev.filter(p => p.id !== burst.id));
        }, 1000);
    }, []);

    // ── Slash commands definition ─────────────────────────────────────────
    const SLASH_COMMANDS = [
        { name: 'roll', desc: 'Roll dice  e.g. /roll 2d6', usage: '/roll [NdN]' },
        { name: 'flip', desc: 'Flip a coin', usage: '/flip' },
        { name: 'coinflip', desc: 'Flip a coin', usage: '/coinflip' },
        { name: '8ball', desc: 'Ask the magic 8-ball', usage: '/8ball [question]' },
        { name: 'me', desc: 'Perform an action (italic)', usage: '/me [text]' },
        { name: 'spoiler', desc: 'Send a spoiler message', usage: '/spoiler [text]' },
        { name: 'shrug', desc: 'Shrug ¯\\_(ツ)_/¯', usage: '/shrug' },
        { name: 'lenny', desc: 'Lenny face ( ͡° ͜ʖ ͡°)', usage: '/lenny' },
        { name: 'tableflip', desc: 'Table flip (╯°□°）╯︵ ┻━┻', usage: '/tableflip' },
        { name: 'unflip', desc: 'Unflip ┬─┬ノ( º _ ºノ)', usage: '/unflip' },
        { name: 'giphy', desc: 'Search for a GIF', usage: '/giphy [query]' },
    ];

    const processSlashCommand = (input) => {
        const parts = input.trim().split(/\s+/);
        const cmd = parts[0].slice(1).toLowerCase();
        const args = parts.slice(1).join(' ');

        const EIGHTBALL_RESPONSES = [
            'It is certain.', 'Without a doubt.', 'You may rely on it.',
            'Yes, definitely!', 'Most likely.', 'Outlook good.',
            'Signs point to yes.', "Don't count on it.", 'My reply is no.',
            'Very doubtful.', 'Ask again later.', 'Cannot predict now.',
            'Better not tell you now.', 'Concentrate and ask again.', 'Outlook not so good.',
        ];

        if (cmd === 'flip' || cmd === 'coinflip') {
            return Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
        }
        if (cmd === 'shrug') return '¯\\\\\\_(ツ)\\_/¯';
        if (cmd === 'lenny') return '( ͡° ͜ʖ ͡°)';
        if (cmd === 'tableflip') return '(╯°□°）╯︵ ┻━┻';
        if (cmd === 'unflip') return '┬─┬ノ( º _ ºノ)';
        if (cmd === 'me') return args ? `*${args}*` : null;
        if (cmd === 'spoiler') return args ? `||${args}||` : null;
        if (cmd === '8ball') {
            const answer = EIGHTBALL_RESPONSES[Math.floor(Math.random() * EIGHTBALL_RESPONSES.length)];
            return args ? `🎱 *${args}*\n**${answer}**` : `🎱 **${answer}**`;
        }
        if (cmd === 'roll') {
            const diceRegex = /(\d+)d(\d+)/i;
            const m = (args || '1d6').match(diceRegex);
            if (m) {
                const num = Math.min(parseInt(m[1]), 100);
                const sides = Math.min(parseInt(m[2]), 10000);
                const results = Array.from({ length: num }, () => Math.ceil(Math.random() * sides));
                const total = results.reduce((a, b) => a + b, 0);
                return `🎲 Rolled **${num}d${sides}**: [${results.join(', ')}] = **${total}**`;
            }
            return `🎲 Rolled **1d6**: **${Math.ceil(Math.random() * 6)}**`;
        }
        if (cmd === 'giphy') {
            // Just send the search as text — actual Giphy integration would need API key
            return `🔍 GIF search: *${args || 'random'}*`;
        }
        return null;
    };

    // ── Fetch server members for @mention autocomplete ────────────────────
    useEffect(() => {
        if (!activeServerId || activeServerId === 'home') {
            setServerMembers([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const memberSnap = await getDocs(query(collection(db, 'servers', activeServerId, 'members'), limit(100)));
                const memberIds = memberSnap.docs.map(d => d.id);
                const userDocs = await Promise.all(memberIds.map(uid => getDoc(doc(db, 'users', uid))));
                if (!cancelled) {
                    setServerMembers(userDocs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() })));
                }
            } catch (e) {
                if (import.meta.env.DEV) console.error('Error fetching members for mention:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [activeServerId]);

    // ── Scroll detection for jump-to-bottom ───────────────────────────────
    useEffect(() => {
        const container = messagesScrollRef.current;
        if (!container) return;
        const onScroll = () => {
            const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
            setIsAtBottom(atBottom);
            if (atBottom) setUnreadCount(0);
        };
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [activeChannelId]);

    // Track unread count when NOT at bottom
    useEffect(() => {
        if (!isAtBottom && messages.length > 0) {
            setUnreadCount(prev => prev + 1);
        }
    }, [messages.length]);

    // Reset unread on channel change
    useEffect(() => {
        setUnreadCount(0);
        setIsAtBottom(true);
    }, [activeChannelId]);

    // ── Mention query filtering ───────────────────────────────────────────
    useEffect(() => {
        if (mentionQuery === null) { setMentionResults([]); return; }
        const q = mentionQuery.toLowerCase();
        const results = serverMembers
            .filter(m => m.displayName?.toLowerCase().includes(q) && m.uid !== currentUser.uid)
            .slice(0, 8);
        setMentionResults(results);
        setMentionIndex(0);
    }, [mentionQuery, serverMembers]);

    // Fetch server data for permission checks
    useEffect(() => {
        if (!activeServerId || activeServerId === 'home') {
            setServerData(null);
            setCurrentUserMember(null);
            return;
        }

        const unsubServer = onSnapshot(doc(db, "servers", activeServerId), (docSnap) => {
            if (docSnap.exists()) setServerData(docSnap.data());
        });

        const unsubMember = onSnapshot(doc(db, "servers", activeServerId, "members", currentUser.uid), (docSnap) => {
            if (docSnap.exists()) setCurrentUserMember(docSnap.data());
            else setCurrentUserMember(null);
        });

        return () => { unsubServer(); unsubMember(); };
    }, [activeServerId, currentUser.uid]);

    const canModerate = useMemo(() => {
        if (isSuperAdmin(currentUser)) return true;
        return hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.MANAGE_MESSAGES);
    }, [currentUser, serverData, currentUserMember]);

    const canPin = useMemo(() => {
        if (isSuperAdmin(currentUser)) return true;
        return hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.PIN_MESSAGES);
    }, [currentUser, serverData, currentUserMember]);

    // Request Notification Permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Fetch messages
    useEffect(() => {
        setMessagesLoading(true);
    }, [activeChannelId]);

    useEffect(() => {
        if (!activeChannelId) return;

        const q = query(
            collection(db, "messages"),
            where("channel", "==", activeChannelId),
            orderBy("createdAt")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessagesLoading(false);
            const retentionLimit = new Date();
            retentionLimit.setMonth(retentionLimit.getMonth() - MESSAGE_RETENTION_MONTHS);

            const msgs = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(msg => {
                    // Filter out messages without timestamps (orphaned data)
                    if (!msg.createdAt) return false;
                    return msg.createdAt.toDate() > retentionLimit;
                });

            setMessages(msgs);

            // Notification Logic
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    const msgTime = msg.createdAt ? msg.createdAt.toDate() : new Date();
                    const isRecent = (new Date() - msgTime) < 30000;

                    if (msg.uid !== currentUser.uid && isRecent) {
                        playNotification();

                        if (document.hidden) {
                            if ('Notification' in window && Notification.permission === 'granted') {
                                try {
                                    new Notification(`New message in #${activeChannelName}`, {
                                        body: `${msg.displayName}: ${msg.text || 'Sent an attachment'}`,
                                        icon: '/favicon.ico'
                                    });
                                } catch (e) {
                                    if (import.meta.env.DEV) console.error("Notification failed:", e);
                                }
                            }
                        }
                    }
                }
            });

            // Update read state
            if (currentUser?.uid && activeChannelId) {
                setDoc(doc(db, "users", currentUser.uid, "readState", activeChannelId), {
                    lastRead: serverTimestamp(),
                    channelId: activeChannelId
                }, { merge: true }).catch(() => {});
            }
        }, (error) => {
            if (import.meta.env.DEV) console.error("Error fetching messages: ", error);
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
                    if (new Date() - data.timestamp.toDate() < TYPING_INDICATOR_TTL_MS) {
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

    // Cleanup typing status on unmount or channel switch
    useEffect(() => {
        return () => {
            if (activeChannelId && currentUser?.uid) {
                deleteDoc(doc(db, "typing", activeChannelId, "users", currentUser.uid)).catch(() => {});
            }
        };
    }, [activeChannelId, currentUser?.uid]);

    const scrollToBottom = () => {
        setTimeout(() => {
            const container = messagesScrollRef.current;
            if (!container) return;
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }, 100);
    };

    const scrollToMessage = (messageId) => {
        const el = messageRefs.current[messageId];
        const container = messagesScrollRef.current;
        if (el && container) {
            const top = el.offsetTop - (container.clientHeight / 2) + (el.clientHeight / 2);
            container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            el.style.backgroundColor = 'rgba(88, 101, 242, 0.2)';
            setTimeout(() => { el.style.backgroundColor = ''; }, 2000);
        }
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
        const value = e.target.value;
        if (value.length > MAX_MESSAGE_LENGTH) return;
        setNewMessage(value);

        // ── Slash command detection ───────────────────────────────────────
        if (value.startsWith('/') && !value.includes(' ')) {
            setSlashQuery(value.slice(1).toLowerCase());
            setMentionQuery(null);
        } else {
            setSlashQuery(null);
        }

        // ── @mention detection (at cursor) ────────────────────────────────
        const cursorPos = e.target.selectionStart ?? value.length;
        const textUpToCursor = value.slice(0, cursorPos);
        const atMatch = textUpToCursor.match(/@(\w*)$/);
        if (atMatch && activeServerId !== 'home') {
            setMentionQuery(atMatch[1]);
            setMentionStart(cursorPos - atMatch[0].length);
        } else {
            setMentionQuery(null);
            setMentionStart(-1);
        }

        updateTypingStatus(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => updateTypingStatus(false), TYPING_TIMEOUT_MS);
    };

    const insertMention = (member) => {
        const before = newMessage.slice(0, mentionStart);
        const after = newMessage.slice(inputRef.current?.selectionStart ?? newMessage.length);
        const mention = `<@${member.displayName}> `;
        const newVal = before + mention + after;
        setNewMessage(newVal);
        setMentionQuery(null);
        setMentionStart(-1);
        setMentionResults([]);
        inputRef.current?.focus();
    };

    const selectSlashCommand = (cmdName) => {
        setNewMessage('/' + cmdName + ' ');
        setSlashQuery(null);
        inputRef.current?.focus();
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

                        try {
                            const { loadImage, checkImage } = await import('../utils/imageFilter');
                            const img = await loadImage(base64Data);
                            const result = await checkImage(img);

                            if (result.isNSFW) {
                                alert(`Paste rejected: ${result.reason}`);
                                return;
                            }
                        } catch (filterError) {
                            if (import.meta.env.DEV) console.error("Filter check failed:", filterError);
                            alert("Image safety check failed. Please try uploading instead.");
                            return;
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

        // Rate limiting
        const now = Date.now();
        if (now - lastMessageTimeRef.current < MESSAGE_COOLDOWN_MS) {
            return;
        }
        lastMessageTimeRef.current = now;

        // Message length check
        if (newMessage.length > MAX_MESSAGE_LENGTH) {
            alert(`Message too long! Maximum ${MAX_MESSAGE_LENGTH} characters.`);
            return;
        }

        // ── Slash command processing ──────────────────────────────────────
        let finalMessage = newMessage;
        if (newMessage.trim().startsWith('/') && !editingMessage) {
            const processed = processSlashCommand(newMessage.trim());
            if (processed !== null) {
                finalMessage = processed;
            } else {
                // Unknown command — send as-is
                finalMessage = newMessage;
            }
        }
        setMentionQuery(null);
        setSlashQuery(null);

        updateTypingStatus(false);
        setIsUploading(true);

        try {
            if (editingMessage) {
                await updateDoc(doc(db, "messages", editingMessage.id), {
                    text: newMessage,
                    edited: true,
                    editedAt: serverTimestamp()
                });
                setEditingMessage(null);
            } else {
                // Build message data
                const baseMessage = {
                    createdAt: serverTimestamp(),
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    photoURL: currentUser.photoURL,
                    channel: activeChannelId
                };

                // Add reply reference if replying
                if (replyingTo) {
                    baseMessage.replyTo = {
                        id: replyingTo.id,
                        text: (replyingTo.text || '').slice(0, 100),
                        displayName: replyingTo.displayName
                    };
                }

                if (finalMessage.trim()) {
                    await addDoc(collection(db, "messages"), {
                        ...baseMessage,
                        text: finalMessage
                    });
                }

                for (const attachment of pendingAttachments) {
                    await addDoc(collection(db, "messages"), {
                        ...baseMessage,
                        attachment: attachment
                    });
                }
            }

            fireSendBurst();
            setNewMessage('');
            setPendingAttachments([]);
            setReplyingTo(null);
            inputRef.current?.focus();
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error sending message:", error);
            alert("Failed to send message.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleEmojiSelect = (emoji) => {
        if (newMessage.length + emoji.length <= MAX_MESSAGE_LENGTH) {
            setNewMessage(prev => prev + emoji);
        }
        inputRef.current?.focus();
    };

    const handleGifSelect = async (gifUrl) => {
        if (!activeChannelId) return;

        const now = Date.now();
        if (now - lastMessageTimeRef.current < MESSAGE_COOLDOWN_MS) return;
        lastMessageTimeRef.current = now;

        await addDoc(collection(db, "messages"), {
            gifUrl,
            createdAt: serverTimestamp(),
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            photoURL: currentUser.photoURL,
            channel: activeChannelId,
            ...(replyingTo ? { replyTo: { id: replyingTo.id, text: (replyingTo.text || '').slice(0, 100), displayName: replyingTo.displayName } } : {})
        });

        setShowGifPicker(false);
        setReplyingTo(null);
    };

    const handleFileSelect = async (fileData) => {
        if (!activeChannelId) return;

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
        setReplyingTo(null);
        inputRef.current?.focus();
    };

    const handleDeleteMessage = async (messageId) => {
        setConfirmDialog({
            title: 'Delete Message',
            message: 'Are you sure you want to delete this message? This cannot be undone.',
            danger: true,
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, "messages", messageId));
                } catch (error) {
                    if (import.meta.env.DEV) console.error("Error deleting message:", error);
                }
            }
        });
    };

    const handleReplyMessage = (message) => {
        setReplyingTo(message);
        setEditingMessage(null);
        inputRef.current?.focus();
    };

    const handleReaction = async (messageId, emoji) => {
        try {
            const messageRef = doc(db, "messages", messageId);
            const messageDoc = await getDoc(messageRef);
            if (!messageDoc.exists()) return;

            const reactions = messageDoc.data().reactions || {};
            const userReactions = reactions[currentUser.uid] || [];

            if (userReactions.includes(emoji)) {
                // Remove reaction
                const newUserReactions = userReactions.filter(r => r !== emoji);
                if (newUserReactions.length === 0) {
                    delete reactions[currentUser.uid];
                } else {
                    reactions[currentUser.uid] = newUserReactions;
                }
            } else {
                // Add reaction
                reactions[currentUser.uid] = [...userReactions, emoji];
            }

            await updateDoc(messageRef, { reactions });
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error reacting:", error);
        }
    };

    const handlePinMessage = async (messageId, pinned) => {
        try {
            await updateDoc(doc(db, "messages", messageId), { pinned });
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error pinning:", error);
        }
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setNewMessage('');
    };

    const cancelReply = () => {
        setReplyingTo(null);
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
            if (import.meta.env.DEV) console.error("Error submitting report:", error);
            alert("Failed to submit report.");
        }
    };

    const startCall = () => {
        if (!activeDmUser) return;
        setActiveCall({ isCaller: true, remoteUserId: activeDmUser.uid });
    };

    // Filter messages for search
    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return messages;
        const q = searchQuery.toLowerCase();
        return messages.filter(msg =>
            msg.text?.toLowerCase().includes(q) ||
            msg.displayName?.toLowerCase().includes(q)
        );
    }, [messages, searchQuery]);

    // Get pinned messages
    const pinnedMessages = useMemo(() => messages.filter(m => m.pinned), [messages]);

    // Typing indicator text
    const typingText = useMemo(() => {
        if (typingUsers.length === 0) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
        if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
        return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;
    }, [typingUsers]);

    if (!activeChannelId) {
        return (
            <div className="liquid-panel chat-shell chat-empty-shell" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)',
                flexDirection: 'column', padding: '20px',
            }}>
                {isMobile && (
                    <button onClick={onOpenMenu} className="glossy-button" style={{ marginBottom: '24px' }}>
                        <Menu size={20} /> Open Menu
                    </button>
                )}
                <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ textAlign: 'center' }}
                >
                    <motion.div
                        animate={{ y: [0, -12, 0] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', marginBottom: '20px' }}
                    >
                        <Hash size={38} color="rgba(168,85,247,0.5)" />
                    </motion.div>
                    <h3 style={{ textAlign: 'center', fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Pick a channel
                    </h3>
                    <p style={{ fontSize: '14px' }}>Select a channel or DM on the left to start chatting.</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="liquid-panel chat-shell" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            height: '100%',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div className="chat-header" style={{
                height: isMobile ? '52px' : '58px',
                padding: isMobile ? '0 12px' : '0 18px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid rgba(168,85,247,0.1)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
                flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02)), rgba(8,5,18,0.9)',
                backdropFilter: 'blur(18px)',
                zIndex: 20,
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
                    {/* Pinned Messages */}
                    {pinnedMessages.length > 0 && (
                        <button
                            className="icon-btn"
                            onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                            title={`${pinnedMessages.length} pinned messages`}
                            style={{ position: 'relative' }}
                        >
                            <Pin size={20} />
                            <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                backgroundColor: 'var(--accent)',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 700,
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
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
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
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
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '6px', top: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    <X size={12} color="var(--text-muted)" />
                                </button>
                            )}
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

            {/* Pinned Messages Panel */}
            <AnimatePresence>
                {showPinnedMessages && pinnedMessages.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{
                            background: 'linear-gradient(180deg, rgba(168,85,247,0.08), rgba(168,85,247,0.03))',
                            borderBottom: '1px solid rgba(168,85,247,0.15)',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ padding: '12px 16px', maxHeight: '200px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#facc15' }}>
                                    <Pin size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    Pinned Messages ({pinnedMessages.length})
                                </span>
                                <button onClick={() => setShowPinnedMessages(false)} className="icon-btn">
                                    <X size={16} />
                                </button>
                            </div>
                            {pinnedMessages.map(msg => (
                                <div
                                    key={msg.id}
                                    onClick={() => { scrollToMessage(msg.id); setShowPinnedMessages(false); }}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        marginBottom: '4px',
                                        fontSize: '13px'
                                    }}
                                    className="hover:bg-white/5"
                                >
                                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{msg.displayName}</span>
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                                        {(msg.text || 'Attachment').slice(0, 80)}{msg.text?.length > 80 ? '...' : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search results indicator */}
            {searchQuery && (
                <div style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--accent-dim)',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>Found {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} for "{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="icon-btn"><X size={14} /></button>
                </div>
            )}

            <div className="chat-body-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Main Chat Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
                    {/* Messages */}
                    <div ref={messagesScrollRef} className="chat-message-scroll" style={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        paddingBottom: isMobile ? '100px' : '20px',
                        paddingTop: '10px'
                    }}>
                        {/* Skeleton loading */}
                        {messagesLoading && (
                            <div style={{ padding: '20px 16px' }}>
                                {[...Array(6)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.06 }}
                                        style={{ display: 'flex', gap: '14px', marginBottom: '20px', alignItems: 'flex-start' }}
                                    >
                                        {/* Avatar skeleton */}
                                        <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
                                        {/* Content skeletons */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                                            <div className="skeleton" style={{ height: '12px', width: `${40 + Math.random() * 30}%`, borderRadius: '6px' }} />
                                            <div className="skeleton" style={{ height: '14px', width: `${50 + Math.random() * 40}%`, borderRadius: '6px' }} />
                                            {i % 3 === 0 && <div className="skeleton" style={{ height: '14px', width: `${30 + Math.random() * 30}%`, borderRadius: '6px' }} />}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {!messagesLoading && filteredMessages.length === 0 && !searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}
                            >
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{ display: 'inline-block', marginBottom: '20px' }}
                                >
                                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                        <Hash size={36} color="rgba(168,85,247,0.5)" />
                                    </div>
                                </motion.div>
                                <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.15rem' }}>
                                    Welcome to #{activeChannelName}!
                                </h3>
                                <p style={{ fontSize: '14px' }}>This is the start of the #{activeChannelName} channel. Say hello!</p>
                            </motion.div>
                        )}

                        {!messagesLoading && (
                            <AnimatePresence>
                                {filteredMessages.map((msg, index) => {
                                    const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                                    // Date separator
                                    let dateSep = null;
                                    if (msg.createdAt) {
                                        const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                                        const prevDate = prevMsg?.createdAt
                                            ? (prevMsg.createdAt.toDate ? prevMsg.createdAt.toDate() : new Date(prevMsg.createdAt))
                                            : null;
                                        const isNewDay = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                                        if (isNewDay) {
                                            const now = new Date();
                                            const today = now.toDateString();
                                            const yesterday = new Date(now - 86400000).toDateString();
                                            const label = msgDate.toDateString() === today ? 'Today'
                                                : msgDate.toDateString() === yesterday ? 'Yesterday'
                                                : msgDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
                                            dateSep = (
                                                <div key={`sep-${msg.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 8px', userSelect: 'none' }}>
                                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.2))' }} />
                                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', padding: '3px 10px', background: 'rgba(168,85,247,0.06)', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.12)' }}>
                                                        {label}
                                                    </span>
                                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(168,85,247,0.2), transparent)' }} />
                                                </div>
                                            );
                                        }
                                    }
                                    return (
                                    <div key={msg.id}>
                                        {dateSep}
                                    <motion.div
                                        ref={el => messageRefs.current[msg.id] = el}
                                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.7 }}
                                        style={{ transition: 'background-color 0.5s' }}
                                    >
                                        <Message
                                            message={msg}
                                            prevMessage={prevMsg}
                                            currentUser={currentUser}
                                            onEdit={handleEditMessage}
                                            onDelete={handleDeleteMessage}
                                            onReply={handleReplyMessage}
                                            onReport={handleReport}
                                            onViewProfile={(uid, displayName, photoURL) => setSelectedUserProfile({ uid, displayName, photoURL })}
                                            onImageClick={(url) => setEnlargedImage(url)}
                                            onReact={handleReaction}
                                            onPin={canPin ? handlePinMessage : null}
                                            canModerate={canModerate}
                                            onScrollToMessage={scrollToMessage}
                                        />
                                    </motion.div>
                                    </div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Typing Indicator */}
                    <AnimatePresence>
                        {typingText && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.2 }}
                                style={{ padding: '4px 18px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                    {[0, 1, 2].map(i => (
                                        <motion.span
                                            key={i}
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                                            style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'inline-block' }}
                                        />
                                    ))}
                                </span>
                                <span style={{ fontStyle: 'italic' }}><strong style={{ color: '#c084fc', fontStyle: 'normal' }}>{typingText}</strong></span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Jump-to-bottom button */}
                    <AnimatePresence>
                        {!isAtBottom && (
                            <motion.button
                                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                                onClick={() => { scrollToBottom(); setUnreadCount(0); }}
                                style={{
                                    position: 'absolute', bottom: isMobile ? '90px' : '80px',
                                    left: '50%', transform: 'translateX(-50%)',
                                    zIndex: 30,
                                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                    border: 'none', borderRadius: '20px',
                                    padding: '8px 16px',
                                    color: 'white', fontWeight: 700, fontSize: '13px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: '0 4px 20px rgba(168,85,247,0.5)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                ↓ Jump to bottom
                                {unreadCount > 0 && (
                                    <span style={{
                                        background: 'rgba(255,255,255,0.25)',
                                        borderRadius: '10px', padding: '1px 7px', fontSize: '12px',
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>

                    <div className="chat-composer-zone" style={{
                        padding: isMobile ? '12px' : '16px',
                        paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : '20px',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-primary)',
                        borderTop: isMobile ? '1px solid var(--glass-border)' : 'none',
                        zIndex: 10,
                        position: 'relative',
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
                                    backgroundColor: 'rgba(88, 101, 242, 0.1)',
                                    borderRadius: '8px',
                                    borderLeft: '3px solid var(--accent)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <Reply size={16} color="var(--accent)" />
                                    <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>
                                        Replying to {replyingTo.displayName}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {(replyingTo.text || 'Attachment').slice(0, 50)}
                                    </span>
                                </div>
                                <button onClick={cancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                    <X size={16} color="var(--text-muted)" />
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

                        {/* @mention autocomplete */}
                        <AnimatePresence>
                            {mentionQuery !== null && mentionResults.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 6 }}
                                    transition={{ duration: 0.15 }}
                                    style={{
                                        background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                                        border: '1px solid rgba(168,85,247,0.25)',
                                        borderRadius: '12px',
                                        marginBottom: '8px',
                                        overflow: 'hidden',
                                        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
                                    }}
                                >
                                    <div style={{ padding: '6px 10px', fontSize: '11px', color: 'rgba(168,85,247,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(168,85,247,0.1)' }}>
                                        Members — Tab to select
                                    </div>
                                    {mentionResults.map((member, i) => (
                                        <motion.div
                                            key={member.uid}
                                            whileHover={{ backgroundColor: 'rgba(168,85,247,0.12)' }}
                                            onClick={() => insertMention(member)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '8px 12px', cursor: 'pointer',
                                                backgroundColor: i === mentionIndex ? 'rgba(168,85,247,0.15)' : 'transparent',
                                                transition: 'background-color 0.1s',
                                            }}
                                        >
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                backgroundImage: member.photoURL ? `url(${member.photoURL})` : 'linear-gradient(135deg,#a855f7,#ec4899)',
                                                backgroundSize: 'cover',
                                                flexShrink: 0,
                                                border: '1px solid rgba(168,85,247,0.3)',
                                            }} />
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: i === mentionIndex ? '#c084fc' : 'var(--text-primary)' }}>
                                                {member.displayName}
                                            </span>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Slash command menu */}
                        <AnimatePresence>
                            {slashQuery !== null && (() => {
                                const filtered = SLASH_COMMANDS.filter(c => c.name.startsWith(slashQuery));
                                return filtered.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 6 }}
                                        transition={{ duration: 0.15 }}
                                        style={{
                                            background: 'linear-gradient(160deg, rgba(19,13,34,0.99), rgba(9,6,20,0.99))',
                                            border: '1px solid rgba(168,85,247,0.25)',
                                            borderRadius: '12px',
                                            marginBottom: '8px',
                                            overflow: 'hidden',
                                            boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
                                        }}
                                    >
                                        <div style={{ padding: '6px 10px', fontSize: '11px', color: 'rgba(168,85,247,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(168,85,247,0.1)' }}>
                                            Slash Commands
                                        </div>
                                        {filtered.map((cmd, i) => (
                                            <motion.div
                                                key={cmd.name}
                                                whileHover={{ backgroundColor: 'rgba(168,85,247,0.12)' }}
                                                onClick={() => selectSlashCommand(cmd.name)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '9px 14px', cursor: 'pointer',
                                                    backgroundColor: i === mentionIndex % filtered.length ? 'rgba(168,85,247,0.15)' : 'transparent',
                                                    transition: 'background-color 0.1s',
                                                }}
                                            >
                                                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#c084fc', fontWeight: 700, minWidth: '90px' }}>
                                                    /{cmd.name}
                                                </span>
                                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{cmd.desc}</span>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                );
                            })()}
                        </AnimatePresence>

                        <form
                            className="chat-composer-shell"
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
                                    // Navigate mention autocomplete
                                    if (mentionQuery !== null && mentionResults.length > 0) {
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionResults.length); return; }
                                        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionResults.length) % mentionResults.length); return; }
                                        if (e.key === 'Tab' || (e.key === 'Enter' && mentionResults.length > 0)) {
                                            e.preventDefault();
                                            insertMention(mentionResults[mentionIndex]);
                                            return;
                                        }
                                        if (e.key === 'Escape') { setMentionQuery(null); return; }
                                    }
                                    // Navigate slash commands
                                    const filteredCmds = slashQuery !== null ? SLASH_COMMANDS.filter(c => c.name.startsWith(slashQuery)) : [];
                                    if (slashQuery !== null && filteredCmds.length > 0) {
                                        if (e.key === 'Tab' || e.key === 'Enter') {
                                            e.preventDefault();
                                            selectSlashCommand(filteredCmds[mentionIndex % filteredCmds.length].name);
                                            return;
                                        }
                                        if (e.key === 'Escape') { setSlashQuery(null); return; }
                                    }
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                    if (e.key === 'Escape') {
                                        if (editingMessage) cancelEdit();
                                        if (replyingTo) cancelReply();
                                    }
                                }}
                                onPaste={handlePaste}
                                placeholder={
                                    editingMessage ? 'Edit your message...' :
                                    replyingTo ? `Reply to ${replyingTo.displayName}...` :
                                    `Message #${activeChannelName}`
                                }
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

                            {/* Character count */}
                            {newMessage.length > MAX_MESSAGE_LENGTH * 0.8 && (
                                <span style={{
                                    fontSize: '11px',
                                    color: newMessage.length > MAX_MESSAGE_LENGTH ? 'var(--error)' : 'var(--text-muted)',
                                    marginRight: '8px',
                                    fontWeight: 600
                                }}>
                                    {newMessage.length}/{MAX_MESSAGE_LENGTH}
                                </span>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
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

                                {(newMessage.trim() || editingMessage || pendingAttachments.length > 0) && (
                                    <div style={{ position: 'relative' }}>
                                        {/* Ripple ring on send */}
                                        <AnimatePresence>
                                            {sendRipple && (
                                                <motion.div
                                                    key="ripple"
                                                    initial={{ scale: 0.6, opacity: 0.9 }}
                                                    animate={{ scale: 2.8, opacity: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: '10px',
                                                        border: '2px solid #a855f7',
                                                        pointerEvents: 'none',
                                                    }}
                                                />
                                            )}
                                        </AnimatePresence>
                                        <motion.button
                                            ref={sendBtnRef}
                                            initial={{ scale: 0, rotate: -15 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            exit={{ scale: 0, rotate: 15 }}
                                            whileHover={{ scale: 1.14, boxShadow: '0 6px 24px rgba(168,85,247,0.6)' }}
                                            whileTap={{ scale: 0.85, rotate: 10 }}
                                            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                                            type="submit"
                                            style={{
                                                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '8px',
                                                color: 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 4px 18px rgba(168,85,247,0.45)',
                                                position: 'relative',
                                            }}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
                                        </motion.button>
                                    </div>
                                )}

                                <EmojiPicker
                                    isOpen={showEmojiPicker}
                                    onClose={() => setShowEmojiPicker(false)}
                                    onEmojiSelect={handleEmojiSelect}
                                    position="top"
                                    isMobile={isMobile}
                                />

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

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={!!confirmDialog}
                onClose={() => setConfirmDialog(null)}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                confirmText={confirmDialog?.confirmText}
                danger={confirmDialog?.danger}
                onConfirm={confirmDialog?.onConfirm || (() => {})}
            />

            {/* Send particle burst */}
            <SendParticles bursts={sendParticles} />

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
