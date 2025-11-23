import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import userAvatar from '../assets/user_avatar.png';

export default function MemberList({ serverId }) {
    const [members, setMembers] = useState([]);

    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        // In a real app, we would query a subcollection 'members' or filter users by server membership.
        // For this demo, we'll fetch all users and simulate membership or check a 'servers' array on the user.
        // Let's assume we query all users for now as a simple "server" list (since we don't have invite logic yet).
        // OR better: we can query users who have this serverId in a 'joinedServers' array.
        // But we haven't implemented 'joinedServers' yet.
        // Let's just show ALL users for now to demonstrate the UI, or maybe filter by those who have "joined" (if we had that).
        // Actually, let's just query 'users' collection.

        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => {
                const data = doc.data();
                const isOnline = data.lastSeen && (new Date() - data.lastSeen.toDate()) < 2 * 60 * 1000;
                return {
                    uid: doc.id,
                    ...data,
                    status: isOnline ? 'online' : 'offline'
                };
            });

            // Sort: Online first, then alphabetical
            users.sort((a, b) => {
                if (a.status === b.status) return a.displayName.localeCompare(b.displayName);
                return a.status === 'online' ? -1 : 1;
            });

            setMembers(users);
        });

        return unsubscribe;
    }, [serverId]);

    return (
        <div style={{
            width: '240px',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            overflowY: 'auto'
        }}>
            <h3 style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '16px'
            }}>
                Members — {members.length}
            </h3>

            {members.map(member => (
                <div key={member.uid} style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    opacity: member.status === 'offline' ? 0.5 : 1
                }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-tertiary)',
                            backgroundImage: `url(${member.photoURL || userAvatar})`,
                            backgroundSize: 'cover',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginRight: '10px'
                        }}>
                            {!member.photoURL && !userAvatar && member.displayName?.[0]}
                        </div>
                        {member.status === 'online' && (
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                right: '10px',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--success)',
                                border: '2px solid var(--bg-secondary)'
                            }} />
                        )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: member.status === 'online' ? 'white' : 'var(--text-secondary)' }}>
                            {member.displayName}
                        </div>
                        {/* Role placeholder */}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Member
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
