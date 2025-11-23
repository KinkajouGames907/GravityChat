import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageCircle, MoreVertical, Check, X, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import userAvatar from '../assets/user_avatar.png';

export default function FriendList({ onStartDM }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('online'); // online, all, pending, blocked, add
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [addFriendInput, setAddFriendInput] = useState('');
    const [addFriendStatus, setAddFriendStatus] = useState(null); // { type: 'success' | 'error', message: '' }

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

                // Fetch friend's user details
                let friendData = { uid: friendUid, displayName: 'Unknown', photoURL: null, status: 'offline' };
                try {
                    const userDoc = await getDoc(doc(db, "users", friendUid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        // Check online status (active in last 2 minutes)
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

    const sendFriendRequest = async () => {
        if (!addFriendInput.trim()) return;
        setAddFriendStatus({ type: 'loading', message: 'Sending request...' });

        try {
            // 1. Find user by username (displayName)
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

            // 2. Check if already friends or pending
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

            // 3. Send Request (Write to both users' subcollections)
            // My doc: pending_sent
            await setDoc(doc(db, "users", currentUser.uid, "friends", targetUid), {
                status: 'pending_sent',
                createdAt: serverTimestamp()
            });

            // Their doc: pending_received
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

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            {/* Top Bar */}
            <div style={{
                height: '48px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                    <UserPlus size={24} color="var(--text-secondary)" />
                    <span style={{ fontWeight: 700 }}>Friends</span>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    {['Online', 'All', 'Pending', 'Add Friend'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab.toLowerCase().replace(' ', ''))}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === tab.toLowerCase().replace(' ', '') ? 'white' : 'var(--text-secondary)',
                                fontWeight: activeTab === tab.toLowerCase().replace(' ', '') ? 700 : 500,
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor: activeTab === tab.toLowerCase().replace(' ', '') ? 'rgba(255,255,255,0.1)' : 'transparent'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, padding: '24px' }}>

                {/* ADD FRIEND TAB */}
                {activeTab === 'addfriend' && (
                    <div style={{ maxWidth: '600px' }}>
                        <h2 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 700 }}>ADD FRIEND</h2>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            You can add friends with their Gravity username.
                        </div>
                        <div style={{
                            display: 'flex',
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: addFriendStatus?.type === 'error' ? '1px solid var(--error)' : addFriendStatus?.type === 'success' ? '1px solid var(--success)' : '1px solid var(--glass-border)',
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
                                    padding: '12px 0',
                                    color: 'white',
                                    outline: 'none'
                                }}
                            />
                            <button
                                className="glossy-button"
                                onClick={sendFriendRequest}
                                disabled={!addFriendInput}
                                style={{ padding: '6px 16px', fontSize: '13px' }}
                            >
                                Send Friend Request
                            </button>
                        </div>
                        {addFriendStatus && (
                            <div style={{
                                marginTop: '8px',
                                fontSize: '13px',
                                color: addFriendStatus.type === 'error' ? 'var(--error)' : 'var(--success)'
                            }}>
                                {addFriendStatus.message}
                            </div>
                        )}
                    </div>
                )}

                {/* PENDING TAB */}
                {activeTab === 'pending' && (
                    <div>
                        <h2 style={{ marginBottom: '16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Pending Requests — {pendingRequests.length}
                        </h2>
                        {pendingRequests.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', opacity: 0.5 }}>
                                <img src="https://discord.com/assets/b6a6b72c21256391.svg" alt="No requests" style={{ width: '200px', marginBottom: '20px' }} />
                                <div>There are no pending friend requests. Here's Wumpus for now.</div>
                            </div>
                        ) : (
                            pendingRequests.map(req => (
                                <div key={req.uid} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    borderTop: '1px solid var(--glass-border)',
                                    className: 'hover:bg-white/5'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            backgroundImage: `url(${req.photoURL || userAvatar})`,
                                            backgroundSize: 'cover',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>{!req.photoURL && !userAvatar && req.displayName?.[0]}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{req.displayName}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Incoming Friend Request</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => acceptRequest(req.uid)} className="icon-btn" style={{ color: 'var(--success)' }}><Check size={20} /></button>
                                        <button onClick={() => rejectRequest(req.uid)} className="icon-btn" style={{ color: 'var(--error)' }}><X size={20} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ALL / ONLINE TAB */}
                {(activeTab === 'all' || activeTab === 'online') && (
                    <div>
                        <h2 style={{ marginBottom: '16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {activeTab === 'online' ? 'Online Friends' : 'All Friends'} — {friends.length}
                        </h2>
                        {friends.length === 0 ? (
                            <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                No friends found. Go add some!
                            </div>
                        ) : (
                            friends.map(friend => (
                                <div key={friend.uid}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px',
                                        borderTop: '1px solid var(--glass-border)',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:bg-white/5"
                                    onClick={() => onStartDM(friend)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            backgroundImage: `url(${friend.photoURL || userAvatar})`,
                                            backgroundSize: 'cover',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>{!friend.photoURL && !userAvatar && friend.displayName?.[0]}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{friend.displayName}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                {friend.status === 'online' ? 'Online' : 'Offline'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="icon-btn"><MessageCircle size={20} /></button>
                                        <button className="icon-btn"><MoreVertical size={20} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
