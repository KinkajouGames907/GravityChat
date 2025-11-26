import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Crown, Shield } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import userAvatar from '../assets/user_avatar.png';

export default function MemberList({ serverId }) {
    const [members, setMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        // Listen to the members subcollection
        const q = query(collection(db, "servers", serverId, "members"));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const memberPromises = snapshot.docs.map(async (memberDoc) => {
                const memberData = memberDoc.data();
                const uid = memberDoc.id;

                // Fetch user profile
                // In a real app, we might want to cache this or use a separate listener for users
                // For MVP, getting the doc once is okay, but real-time status updates won't reflect immediately 
                // unless we listen to users too. 
                // To keep it simple and fix the "showing non-members" issue first:
                try {
                    const userSnap = await getDoc(doc(db, "users", uid));
                    const userData = userSnap.exists() ? userSnap.data() : {};

                    const isOnline = userData.lastSeen && (new Date() - userData.lastSeen.toDate()) < 2 * 60 * 1000;

                    return {
                        uid,
                        ...userData,
                        ...memberData, // Roles etc
                        status: isOnline ? 'online' : 'offline'
                    };
                } catch (e) {
                    console.error("Error fetching user data for member:", uid, e);
                    return null;
                }
            });

            const resolvedMembers = (await Promise.all(memberPromises)).filter(m => m !== null);

            // Sort: Online first, then alphabetical
            resolvedMembers.sort((a, b) => {
                if (a.status === b.status) return (a.displayName || '').localeCompare(b.displayName || '');
                return a.status === 'online' ? -1 : 1;
            });

            setMembers(resolvedMembers);
        });

        return () => unsubscribe();
    }, [serverId]);

    // Filter members based on search
    const filteredMembers = members.filter(member =>
        member.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const onlineMembers = filteredMembers.filter(m => m.status === 'online');
    const offlineMembers = filteredMembers.filter(m => m.status === 'offline');

    return (
        <div style={{
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px',
                borderBottom: '1px solid var(--glass-border)',
                flexShrink: 0
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    gap: '8px'
                }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Search members"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '13px',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Members List - Scrollable */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '8px'
            }}>
                {/* Online Section */}
                {onlineMembers.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            padding: '8px 12px 4px',
                            letterSpacing: '0.5px'
                        }}>
                            Online — {onlineMembers.length}
                        </h3>
                        {onlineMembers.map((member, index) => (
                            <MemberItem key={member.uid} member={member} index={index} />
                        ))}
                    </div>
                )}

                {/* Offline Section */}
                {offlineMembers.length > 0 && (
                    <div>
                        <h3 style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            padding: '8px 12px 4px',
                            letterSpacing: '0.5px'
                        }}>
                            Offline — {offlineMembers.length}
                        </h3>
                        {offlineMembers.map((member, index) => (
                            <MemberItem key={member.uid} member={member} index={index + onlineMembers.length} />
                        ))}
                    </div>
                )}

                {/* No Results */}
                {filteredMembers.length === 0 && searchQuery && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 16px',
                        color: 'var(--text-muted)',
                        fontSize: '13px'
                    }}>
                        No members found
                    </div>
                )}
            </div>
        </div>
    );
}

const MemberItem = ({ member, index }) => (
    <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        whileHover={{ backgroundColor: 'var(--bg-hover)' }}
        style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            opacity: member.status === 'offline' ? 0.5 : 1,
            transition: 'all 0.15s'
        }}
    >
        <div style={{ position: 'relative', marginRight: '12px' }}>
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                backgroundImage: `url(${member.photoURL || userAvatar})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }} />
            {member.status === 'online' && (
                <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--success)',
                    border: '2px solid var(--bg-secondary)'
                }} />
            )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: member.status === 'online' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {member.displayName || 'Unknown'}
                </span>
                {/* Role badges - placeholder */}
                {member.isOwner && (
                    <Crown size={12} color="#fbbf24" />
                )}
                {member.isMod && (
                    <Shield size={12} color="var(--accent)" />
                )}
            </div>
            {member.customStatus && (
                <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {member.customStatus}
                </div>
            )}
        </div>
    </motion.div>
);
