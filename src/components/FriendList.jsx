import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageCircle, MoreVertical, Check, X, UserPlus, Trash2, Ban, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import userAvatar from '../assets/user_avatar.png';

export default function FriendList({ onStartDM }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('online');
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [addFriendInput, setAddFriendInput] = useState('');
    const [addFriendStatus, setAddFriendStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch Friends and Requests
    useEffect(() => {
        if (!currentUser) return;

        const friendsRef = collection(db, "users", currentUser.uid, "friends");
        const unsubscribe = onSnapshot(friendsRef, async (snapshot) => {
            const friendsList = [];
            const requestsList = [];

            const promises = snapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                const friendUid = docSnapshot.id;

                let friendData = { uid: friendUid, displayName: 'Unknown', photoURL: null, status: 'offline' };
                try {
                    const userDoc = await getDoc(doc(db, "users", friendUid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const isOnline = userData.lastSeen && (new Date() - userData.lastSeen.toDate()) < 2 * 60 * 1000;
                        friendData = {
                            ...userData,
                            uid: friendUid,
                            status: isOnline ? 'online' : 'offline'
                        };
                    }
                } catch (e) {
                    console.error("Error fetching friend details", e);
                }

                if (data.status === 'accepted') {
                    friendsList.push({ ...friendData, ...data });
                } else if (data.status === 'pending_received') {
                    requestsList.push({ ...friendData, ...data });
                }
            });

            await Promise.all(promises);
            setFriends(friendsList);
            setPendingRequests(requestsList);
        });

        return unsubscribe;
    }, [currentUser]);

    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const sendFriendRequest = async () => {
        if (!addFriendInput.trim()) return;
        setAddFriendStatus({ type: 'loading', message: 'Sending request...' });

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("displayName", "==", addFriendInput.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setAddFriendStatus({ type: 'error', message: 'User not found. Check capitalization.' });
                return;
            }

            const targetUserDoc = querySnapshot.docs[0];
            const targetUser = targetUserDoc.data();
            const targetUid = targetUserDoc.id;

            if (targetUid === currentUser.uid) {
                setAddFriendStatus({ type: 'error', message: "You can't add yourself!" });
                return;
            }

            const myFriendDoc = await getDoc(doc(db, "users", currentUser.uid, "friends", targetUid));
            if (myFriendDoc.exists()) {
                const status = myFriendDoc.data().status;
                if (status === 'accepted') {
                    setAddFriendStatus({ type: 'error', message: 'You are already friends!' });
                    return;
                } else if (status === 'pending_sent') {
                    setAddFriendStatus({ type: 'error', message: 'Request already sent.' });
                    return;
                }
            }

            await setDoc(doc(db, "users", currentUser.uid, "friends", targetUid), {
                status: 'pending_sent',
                createdAt: serverTimestamp()
            });

            await setDoc(doc(db, "users", targetUid, "friends", currentUser.uid), {
                status: 'pending_received',
                createdAt: serverTimestamp()
            });

            setAddFriendStatus({ type: 'success', message: `Friend request sent to ${targetUser.displayName}!` });
            setAddFriendInput('');

        } catch (err) {
            console.error("Error sending friend request:", err);
            setAddFriendStatus({ type: 'error', message: 'Failed to send request.' });
        }
    };

    const acceptRequest = async (friendUid) => {
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "friends", friendUid), { status: 'accepted' });
            await updateDoc(doc(db, "users", friendUid, "friends", currentUser.uid), { status: 'accepted' });
        } catch (err) {
            console.error("Error accepting request:", err);
        }
    };

    const rejectRequest = async (friendUid) => {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "friends", friendUid));
            await deleteDoc(doc(db, "users", friendUid, "friends", currentUser.uid));
        } catch (err) {
            console.error("Error rejecting request:", err);
        }
    };

    const removeFriend = async (friendUid) => {
        if (!window.confirm("Are you sure you want to remove this friend?")) return;
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "friends", friendUid));
            await deleteDoc(doc(db, "users", friendUid, "friends", currentUser.uid));
        } catch (err) {
            console.error("Error removing friend:", err);
        }
    };

    const blockUser = async (friendUid) => {
        if (!window.confirm("Are you sure you want to block this user?")) return;
        try {
            await setDoc(doc(db, "users", currentUser.uid, "friends", friendUid), {
                status: 'blocked',
                blockedAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Error blocking user:", err);
        }
    };

    // Filter friends based on search and tab
    const getFilteredFriends = () => {
        let filtered = friends;

        if (activeTab === 'online') {
            filtered = filtered.filter(f => f.status === 'online');
        }

        if (searchQuery) {
            filtered = filtered.filter(f =>
                f.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    };

    const filteredFriends = getFilteredFriends();
    const onlineCount = friends.filter(f => f.status === 'online').length;

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            height: '100%',
            overflow: 'hidden'
        }}>
            {/* Top Bar */}
            <div style={{
                minHeight: '56px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '12px',
                flexShrink: 0,
                backgroundColor: 'var(--bg-secondary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={24} color="var(--accent)" />
                    <span style={{ fontWeight: 700, fontSize: '17px' }}>Friends</span>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flex: 1,
                    overflowX: 'auto',
                    padding: '8px 0',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none'
                }}>
                    {[
                        { id: 'online', label: 'Online', count: onlineCount },
                        { id: 'all', label: 'All', count: friends.length },
                        { id: 'pending', label: 'Pending', count: pendingRequests.length },
                        { id: 'addfriend', label: 'Add Friend' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: activeTab === tab.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                                border: 'none',
                                color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '8px 14px',
                                borderRadius: '20px',
                                whiteSpace: 'nowrap',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span style={{
                                    backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--accent-dim)',
                                    color: activeTab === tab.id ? 'white' : 'var(--accent)',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch'
            }}>
                {/* ADD FRIEND TAB */}
                {activeTab === 'addfriend' && (
                    <div style={{ padding: '24px', maxWidth: '600px' }}>
                        <h2 style={{
                            marginBottom: '8px',
                            fontSize: '20px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Add Friend
                        </h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            You can add friends with their Gravity username.
                        </p>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{
                                display: 'flex',
                                backgroundColor: 'var(--bg-tertiary)',
                                padding: '4px',
                                borderRadius: '12px',
                                border: addFriendStatus?.type === 'error'
                                    ? '2px solid var(--danger)'
                                    : addFriendStatus?.type === 'success'
                                        ? '2px solid var(--success)'
                                        : '2px solid var(--glass-border)',
                                alignItems: 'center'
                            }}>
                                <input
                                    type="text"
                                    placeholder="Enter a username"
                                    value={addFriendInput}
                                    onChange={(e) => setAddFriendInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '12px 16px',
                                        color: 'white',
                                        fontSize: '15px',
                                        outline: 'none'
                                    }}
                                />
                                <button
                                    className="glossy-button"
                                    onClick={sendFriendRequest}
                                    disabled={!addFriendInput}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        borderRadius: '8px',
                                        opacity: addFriendInput ? 1 : 0.5
                                    }}
                                >
                                    Send Request
                                </button>
                            </div>
                            {addFriendStatus && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        backgroundColor: addFriendStatus.type === 'error'
                                            ? 'rgba(244, 33, 46, 0.1)'
                                            : 'rgba(0, 186, 124, 0.1)',
                                        color: addFriendStatus.type === 'error' ? 'var(--danger)' : 'var(--success)'
                                    }}
                                >
                                    {addFriendStatus.message}
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}

                {/* PENDING TAB */}
                {activeTab === 'pending' && (
                    <div style={{ padding: '16px' }}>
                        <h3 style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            marginBottom: '12px',
                            padding: '0 8px'
                        }}>
                            Pending Requests — {pendingRequests.length}
                        </h3>

                        {pendingRequests.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '60px 20px',
                                color: 'var(--text-muted)'
                            }}>
                                <UserPlus size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                <p>No pending friend requests</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {pendingRequests.map(req => (
                                    <motion.div
                                        key={req.uid}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--glass-border)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--bg-tertiary)',
                                                backgroundImage: `url(${req.photoURL || userAvatar})`,
                                                backgroundSize: 'cover'
                                            }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '15px' }}>{req.displayName}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    Incoming Friend Request
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => acceptRequest(req.uid)}
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(0, 186, 124, 0.1)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--success)'
                                                }}
                                            >
                                                <Check size={20} />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => rejectRequest(req.uid)}
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(244, 33, 46, 0.1)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--danger)'
                                                }}
                                            >
                                                <X size={20} />
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ALL / ONLINE TAB */}
                {(activeTab === 'all' || activeTab === 'online') && (
                    <div style={{ padding: '16px' }}>
                        {/* Search Bar */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            marginBottom: '16px',
                            gap: '8px'
                        }}>
                            <Search size={18} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Search friends..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <h3 style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            marginBottom: '12px',
                            padding: '0 8px'
                        }}>
                            {activeTab === 'online' ? 'Online' : 'All Friends'} — {filteredFriends.length}
                        </h3>

                        {filteredFriends.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '60px 20px',
                                color: 'var(--text-muted)'
                            }}>
                                <Users size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                <p>{searchQuery ? 'No friends match your search' : 'No friends found'}</p>
                                <button
                                    onClick={() => setActiveTab('addfriend')}
                                    className="glossy-button"
                                    style={{ marginTop: '16px', padding: '10px 20px' }}
                                >
                                    Add Friends
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {filteredFriends.map(friend => (
                                    <motion.div
                                        key={friend.uid}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onClick={() => onStartDM(friend)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'var(--bg-tertiary)',
                                                    backgroundImage: `url(${friend.photoURL || userAvatar})`,
                                                    backgroundSize: 'cover'
                                                }} />
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '0',
                                                    right: '0',
                                                    width: '14px',
                                                    height: '14px',
                                                    borderRadius: '50%',
                                                    backgroundColor: friend.status === 'online' ? 'var(--success)' : 'var(--text-muted)',
                                                    border: '3px solid var(--bg-primary)'
                                                }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '15px' }}>{friend.displayName}</div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: friend.status === 'online' ? 'var(--success)' : 'var(--text-muted)'
                                                }}>
                                                    {friend.status === 'online' ? 'Online' : 'Offline'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onStartDM(friend);
                                                }}
                                                className="icon-btn"
                                                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                                            >
                                                <MessageCircle size={18} />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                className="icon-btn"
                                                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveDropdown(activeDropdown === friend.uid ? null : friend.uid);
                                                }}
                                            >
                                                <MoreVertical size={18} />
                                            </motion.button>
                                        </div>

                                        {/* Dropdown Menu */}
                                        <AnimatePresence>
                                            {activeDropdown === friend.uid && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '16px',
                                                        top: '100%',
                                                        backgroundColor: 'var(--bg-secondary)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '12px',
                                                        padding: '8px',
                                                        zIndex: 100,
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                                        minWidth: '160px'
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => removeFriend(friend.uid)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            width: '100%',
                                                            padding: '10px 12px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: 'var(--danger)',
                                                            fontSize: '14px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            borderRadius: '8px'
                                                        }}
                                                    >
                                                        <Trash2 size={16} /> Remove Friend
                                                    </button>
                                                    <button
                                                        onClick={() => blockUser(friend.uid)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            width: '100%',
                                                            padding: '10px 12px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: 'var(--danger)',
                                                            fontSize: '14px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            borderRadius: '8px'
                                                        }}
                                                    >
                                                        <Ban size={16} /> Block
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
