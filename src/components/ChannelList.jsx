import { useState, useEffect } from 'react';
import { Hash, Volume2, ChevronDown, Mic, Headphones, Settings, Plus, MessageCircle, Search, X, UserPlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, where, getDocs, setDoc, getDoc, arrayRemove, orderBy } from 'firebase/firestore';
import SettingsModal from './SettingsModal';
import { hasPermission, PERMISSIONS, isServerOwner } from '../utils/permissions';

import channelIcon from '../assets/channel_icon.png';
import userAvatar from '../assets/user_avatar.png';

const getStatusColor = (status) => {
    switch (status) {
        case 'online': return 'var(--success)';
        case 'idle': return '#eab308';
        case 'dnd': return 'var(--danger)';
        default: return 'var(--text-muted)';
    }
};

const ChannelItem = ({ name, type, active, onClick, onDelete, canDelete, index }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            margin: '2px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: active ? 'var(--bg-hover)' : 'transparent',
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'background-color 0.2s, color 0.2s',
            position: 'relative',
            group: 'true' // Helper for hover detection if using CSS, but we'll use JS/CSS class
        }}
        className="channel-item hover:bg-white/5 group"
        whileHover={{ x: 4 }}
    >
        {type === 'voice' ? <Volume2 size={18} style={{ marginRight: '6px' }} /> : <Hash size={18} style={{ marginRight: '6px' }} />}
        <span style={{ fontWeight: 500, fontSize: '15px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>

        {canDelete && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="delete-btn opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="Delete Channel"
            >
                <Trash2 size={14} />
            </button>
        )}
    </motion.div>
);

const DMItem = ({ user, active, onClick, index }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 8px',
            margin: '2px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: active ? 'var(--bg-hover)' : 'transparent',
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'background-color 0.2s, color 0.2s'
        }}
        className="hover:bg-white/5"
        whileHover={{ x: 4 }}
    >
        <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-tertiary)',
            backgroundImage: `url(${user.photoURL || userAvatar})`,
            backgroundSize: 'cover',
            marginRight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700
        }}>
            {!user.photoURL && !userAvatar && user.displayName?.[0].toUpperCase()}
        </div>
        <div style={{
            position: 'absolute',
            bottom: '0',
            right: '10px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(user.status),
            border: '2px solid var(--bg-secondary)'
        }} />
        <span style={{ fontWeight: 500, fontSize: '15px' }}>{user.displayName}</span>
    </motion.div>
);

export default function ChannelList({ activeServerId, activeChannelId, setActiveChannelId, setActiveChannelName, isMobileView, setActiveDmUser }) {
    const { currentUser } = useAuth();
    const [serverData, setServerData] = useState(null);
    const [dms, setDms] = useState([]);
    const [showDmSearch, setShowDmSearch] = useState(false);
    const [dmSearchQuery, setDmSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [currentUserMember, setCurrentUserMember] = useState(null);
    const [roles, setRoles] = useState([]);
    const [userRoleColor, setUserRoleColor] = useState(null);

    // ... (rest of the component logic remains the same until return)

    // Fetch Server Data or DMs
    useEffect(() => {
        if (activeServerId === 'home') {
            setServerData({ name: 'Direct Messages' });

            // Fetch DMs
            if (currentUser) {
                const q = query(collection(db, "dms"), where("participants", "array-contains", currentUser.uid));
                const unsubscribe = onSnapshot(q, async (snapshot) => {
                    const dmList = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                        const data = docSnapshot.data();
                        const otherUserId = data.participants.find(uid => uid !== currentUser.uid);
                        // Fetch other user's details
                        let otherUser = { displayName: 'Unknown User', uid: otherUserId };
                        try {
                            const userDoc = await getDoc(doc(db, "users", otherUserId));
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
                            console.error("Error fetching DM user", e);
                        }

                        return {
                            id: docSnapshot.id,
                            otherUser,
                            ...data
                        };
                    }));
                    setDms(dmList);
                });
                return unsubscribe;
            }
            return;
        }

        const unsubscribe = onSnapshot(doc(db, "servers", activeServerId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setServerData(data);
                // Default to first text channel if none selected
                if (!activeChannelId && data.channels?.length > 0 && !isMobileView) {
                    const firstChannel = data.channels.find(c => c.type === 'text');
                    if (firstChannel) {
                        const uniqueId = `${activeServerId}-${firstChannel.name}`;
                        setActiveChannelId(uniqueId);
                        setActiveChannelName(firstChannel.name);
                    }
                }
            }
        });

        // Fetch current user member data for permissions
        const memberUnsubscribe = onSnapshot(doc(db, "servers", activeServerId, "members", currentUser.uid), (doc) => {
            if (doc.exists()) {
                setCurrentUserMember(doc.data());
            } else {
                setCurrentUserMember(null);
            }
        });

        // Fetch Roles for Color Logic
        const rolesUnsubscribe = onSnapshot(query(collection(db, "servers", activeServerId, "roles"), orderBy("position", "asc")), (snapshot) => {
            const roleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRoles(roleData);
        });

        return () => {
            unsubscribe();
            memberUnsubscribe();
            rolesUnsubscribe();
        };
    }, [activeServerId, currentUser, isMobileView]);

    // Calculate User Role Color
    useEffect(() => {
        if (currentUserMember && roles.length > 0 && currentUserMember.roles && currentUserMember.roles.length > 0) {
            const highestRole = roles.find(r => currentUserMember.roles.includes(r.id));
            if (highestRole && highestRole.color) {
                setUserRoleColor(highestRole.color);
            } else {
                setUserRoleColor(null);
            }
        } else {
            setUserRoleColor(null);
        }
    }, [currentUserMember, roles]);

    // Search Users Effect
    useEffect(() => {
        const searchUsers = async () => {
            if (!dmSearchQuery.trim()) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                // Simple prefix search logic for now
                const usersRef = collection(db, "users");
                const q = query(usersRef);
                const querySnapshot = await getDocs(q);

                const results = [];
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData.uid !== currentUser.uid &&
                        userData.displayName?.toLowerCase().includes(dmSearchQuery.toLowerCase())) {
                        results.push(userData);
                    }
                });
                setSearchResults(results);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300); // Debounce
        return () => clearTimeout(timeoutId);
    }, [dmSearchQuery, currentUser]);


    const handleCreateChannel = async () => {
        const channelName = prompt("Enter channel name:");
        if (!channelName) return;

        try {
            await updateDoc(doc(db, "servers", activeServerId), {
                channels: arrayUnion({
                    name: channelName.toLowerCase().replace(/\s+/g, '-'),
                    type: 'text'
                })
            });
        } catch (err) {
            console.error(err);
            alert("Failed to create channel");
        }
    };

    const startDMWithUser = async (targetUser) => {
        try {
            // Create/Get DM
            const sortedIds = [currentUser.uid, targetUser.uid].sort();
            const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

            await setDoc(doc(db, "dms", dmId), {
                participants: sortedIds,
                updatedAt: new Date(),
                startedBy: currentUser.uid
            }, { merge: true });

            setActiveChannelId(dmId);
            setActiveChannelName(targetUser.displayName);
            if (setActiveDmUser) setActiveDmUser(targetUser);
            setShowDmSearch(false);
            setDmSearchQuery('');
            setSearchResults([]);

        } catch (err) {
            console.error("Error starting DM:", err);
            alert("Error starting DM");
        }
    };

    const handleDeleteChannel = async (channel) => {
        if (!confirm(`Are you sure you want to delete #${channel.name}?`)) return;

        try {
            await updateDoc(doc(db, "servers", activeServerId), {
                channels: arrayRemove(channel)
            });
            // If we deleted the active channel, reset
            if (activeChannelId === `${activeServerId}-${channel.name}`) {
                setActiveChannelId(null);
                setActiveChannelName(null);
            }
        } catch (err) {
            console.error("Error deleting channel:", err);
            alert("Failed to delete channel");
        }
    };

    const canManageChannels = hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.MANAGE_CHANNELS);

    if (activeServerId === 'home') {
        return (
            <div style={{
                width: isMobileView ? '100%' : '240px',
                height: isMobileView ? '100%' : '100vh',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                borderRight: isMobileView ? 'none' : '1px solid var(--glass-border)'
            }}>
                {/* Header */}
                <div style={{
                    height: '48px',
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--glass-border)',
                    fontWeight: 700,
                    fontSize: '16px'
                }}>
                    Direct Messages
                </div>

                {/* DM List */}
                <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
                    <div style={{ padding: '0 8px 8px' }}>
                        <button
                            onClick={() => setActiveChannelId('friends')}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 12px',
                                backgroundColor: activeChannelId === 'friends' ? 'var(--bg-hover)' : 'transparent',
                                color: activeChannelId === 'friends' ? 'white' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '15px',
                                marginBottom: '16px'
                            }}
                            className="hover:bg-white/5"
                        >
                            <UserPlus size={20} style={{ marginRight: '12px' }} />
                            Friends
                        </button>

                        <button
                            className="glossy-button"
                            style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                            onClick={() => setShowDmSearch(!showDmSearch)}
                        >
                            {showDmSearch ? 'Close Search' : 'Start Conversation'}
                        </button>
                    </div>

                    <AnimatePresence>
                        {showDmSearch && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ padding: '0 16px 16px', overflow: 'hidden' }}
                            >
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="Search username..."
                                        value={dmSearchQuery}
                                        onChange={(e) => setDmSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-tertiary)',
                                            border: 'none',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            color: 'white',
                                            fontSize: '13px'
                                        }}
                                        autoFocus
                                    />
                                </div>

                                {/* Search Results */}
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {isSearching ? (
                                        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Searching...</div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map(user => (
                                            <div
                                                key={user.uid}
                                                onClick={() => startDMWithUser(user)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '6px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    marginBottom: '2px'
                                                }}
                                                className="hover:bg-white/10"
                                            >
                                                <div style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'var(--bg-tertiary)',
                                                    backgroundImage: user.photoURL ? `url(${user.photoURL})` : 'none',
                                                    backgroundSize: 'cover',
                                                    marginRight: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px'
                                                }}>
                                                    {!user.photoURL && user.displayName?.[0].toUpperCase()}
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 500 }}>{user.displayName}</span>
                                            </div>
                                        ))
                                    ) : dmSearchQuery && (
                                        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>No users found.</div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {dms.map((dm, index) => (
                            <DMItem
                                key={dm.id}
                                index={index}
                                user={dm.otherUser}
                                active={activeChannelId === dm.id}
                                onClick={() => {
                                    setActiveChannelId(dm.id);
                                    setActiveChannelName(dm.otherUser.displayName);
                                    if (setActiveDmUser) setActiveDmUser(dm.otherUser);
                                }}
                            />
                        ))}
                    </AnimatePresence>
                </div>
                {/* User User Area */}
                <div style={{
                    height: '52px',
                    backgroundColor: '#0b0d0e',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 700
                        }}>
                            {currentUser?.email?.[0].toUpperCase() || 'U'}
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: getStatusColor(currentUser?.status || 'online'),
                            border: '2px solid #0b0d0e'
                        }} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {currentUser?.displayName || 'User'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            #{currentUser?.uid?.substring(0, 4) || '0000'}
                        </div>
                    </div>
                    <div style={{ display: 'flex' }}>
                        <button className="icon-btn"><Mic size={18} /></button>
                        <button className="icon-btn"><Headphones size={18} /></button>
                        <button className="icon-btn" onClick={() => setIsSettingsOpen(true)}><Settings size={18} /></button>
                    </div>
                </div>
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        );
    }

    return (
        <div style={{
            width: isMobileView ? '100%' : '240px',
            height: isMobileView ? '100%' : '100vh',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            borderRight: isMobileView ? 'none' : '1px solid var(--glass-border)'
        }}>
            {/* Server Header */}
            <div style={{
                height: '48px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--glass-border)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '16px'
            }} className="hover:bg-white/5">
                {serverData?.name || 'Loading...'} <ChevronDown size={18} />
            </div>

            {/* Channels */}
            <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
                <div style={{
                    padding: '0 16px 4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>Text Channels</span>
                    <Plus
                        size={14}
                        style={{ cursor: 'pointer' }}
                        onClick={handleCreateChannel}
                    />
                </div>

                <AnimatePresence>
                    {serverData?.channels?.filter(c => c.type === 'text').map((channel, index) => {
                        const uniqueId = `${activeServerId}-${channel.name}`;
                        return (
                            <ChannelItem
                                key={channel.name}
                                index={index}
                                name={channel.name}
                                type="text"
                                active={activeChannelId === uniqueId}
                                onClick={() => {
                                    setActiveChannelId(uniqueId);
                                    setActiveChannelName(channel.name);
                                }}
                                onDelete={() => handleDeleteChannel(channel)}
                                canDelete={canManageChannels}
                            />
                        );
                    })}
                </AnimatePresence>

                <div style={{ padding: '16px 16px 4px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Voice Channels
                </div>
                <AnimatePresence>
                    {serverData?.channels?.filter(c => c.type === 'voice').map((channel, index) => {
                        const uniqueId = `${activeServerId}-${channel.name}`;
                        return (
                            <ChannelItem
                                key={channel.name}
                                index={index}
                                name={channel.name}
                                type="voice"
                                active={activeChannelId === uniqueId}
                                onClick={() => {
                                    setActiveChannelId(uniqueId);
                                    setActiveChannelName(channel.name);
                                }}
                                onDelete={() => handleDeleteChannel(channel)}
                                canDelete={canManageChannels}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* User User Area */}
            <div style={{
                height: '52px',
                backgroundColor: '#0b0d0e',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 700
                    }}>
                        {currentUser?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(currentUser?.status || 'online'),
                        border: '2px solid #0b0d0e'
                    }} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: userRoleColor || 'var(--text-primary)' }}>
                        {currentUser?.displayName || 'User'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        #{currentUser?.uid?.substring(0, 4) || '0000'}
                    </div>
                </div>
                <div style={{ display: 'flex' }}>
                    <button className="icon-btn"><Mic size={18} /></button>
                    <button className="icon-btn"><Headphones size={18} /></button>
                    <button className="icon-btn" onClick={() => setIsSettingsOpen(true)}><Settings size={18} /></button>
                </div>
            </div>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
}
