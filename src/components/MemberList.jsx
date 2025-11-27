import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Crown, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import userAvatar from '../assets/user_avatar.png';
import UserProfileModal from './UserProfileModal';

export default function MemberList({ serverId }) {
    const [members, setMembers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [collapsedRoles, setCollapsedRoles] = useState({});

    // Fetch Roles
    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        const q = query(collection(db, "servers", serverId, "roles"), orderBy("position", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const roleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRoles(roleData);
        });

        return unsubscribe;
    }, [serverId]);

    // Fetch Members
    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        const q = query(collection(db, "servers", serverId, "members"));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const memberPromises = snapshot.docs.map(async (memberDoc) => {
                const memberData = memberDoc.data();
                const uid = memberDoc.id;

                try {
                    const userSnap = await getDoc(doc(db, "users", uid));
                    const userData = userSnap.exists() ? userSnap.data() : {};
                    const isOnline = userData.lastSeen && (new Date() - userData.lastSeen.toDate()) < 2 * 60 * 1000;

                    return {
                        uid,
                        ...userData,
                        ...memberData,
                        status: isOnline ? 'online' : 'offline'
                    };
                } catch (e) {
                    console.error("Error fetching user data:", uid, e);
                    return null;
                }
            });

            const resolvedMembers = (await Promise.all(memberPromises)).filter(m => m !== null);
            setMembers(resolvedMembers);
        });

        return () => unsubscribe();
    }, [serverId]);

    const toggleRoleCollapse = (roleId) => {
        setCollapsedRoles(prev => ({ ...prev, [roleId]: !prev[roleId] }));
    };

    // Group members by role
    const getMemberGroups = () => {
        const groups = {};
        const uncategorized = { online: [], offline: [] };

        // Initialize groups for all roles
        roles.forEach(role => {
            groups[role.id] = [];
        });

        members.forEach(member => {
            if (searchQuery && !member.displayName?.toLowerCase().includes(searchQuery.toLowerCase())) {
                return;
            }

            // Find highest role
            let assigned = false;
            if (member.roles && member.roles.length > 0) {
                // Sort member roles by position (assuming we have full role objects or can map ids)
                // For now, simple check: find the first role in our sorted 'roles' list that the member has
                const highestRole = roles.find(r => member.roles.includes(r.id));
                if (highestRole) {
                    groups[highestRole.id].push(member);
                    assigned = true;
                }
            }

            if (!assigned) {
                if (member.status === 'online') uncategorized.online.push(member);
                else uncategorized.offline.push(member);
            }
        });

        return { groups, uncategorized };
    };

    const { groups, uncategorized } = getMemberGroups();

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

            {/* Members List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '8px'
            }}>
                {/* Role Groups */}
                {roles.map(role => {
                    const roleMembers = groups[role.id] || [];
                    if (roleMembers.length === 0) return null;

                    return (
                        <div key={role.id} style={{ marginBottom: '16px' }}>
                            <div
                                onClick={() => toggleRoleCollapse(role.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '8px 4px',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}
                            >
                                {collapsedRoles[role.id] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                <span style={{ color: role.color || 'inherit' }}>{role.name}</span>
                                <span>— {roleMembers.length}</span>
                            </div>

                            {!collapsedRoles[role.id] && (
                                <div>
                                    {roleMembers.map((member, index) => (
                                        <MemberItem key={member.uid} member={member} index={index} onClick={setSelectedUser} roleColor={role.color} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Online (No Role) */}
                {uncategorized.online.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            padding: '8px 12px 4px',
                            letterSpacing: '0.5px'
                        }}>
                            Online — {uncategorized.online.length}
                        </h3>
                        {uncategorized.online.map((member, index) => (
                            <MemberItem key={member.uid} member={member} index={index} onClick={setSelectedUser} />
                        ))}
                    </div>
                )}

                {/* Offline (No Role) */}
                {uncategorized.offline.length > 0 && (
                    <div>
                        <h3 style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            padding: '8px 12px 4px',
                            letterSpacing: '0.5px'
                        }}>
                            Offline — {uncategorized.offline.length}
                        </h3>
                        {uncategorized.offline.map((member, index) => (
                            <MemberItem key={member.uid} member={member} index={index} onClick={setSelectedUser} />
                        ))}
                    </div>
                )}
            </div>

            <UserProfileModal
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                user={selectedUser}
            />
        </div>
    );
}

const MemberItem = ({ member, index, onClick, roleColor }) => (
    <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        whileHover={{ backgroundColor: 'var(--bg-hover)' }}
        onClick={() => onClick(member)}
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
                    color: roleColor || (member.status === 'online' ? 'var(--text-primary)' : 'var(--text-secondary)'),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {member.displayName || 'Unknown'}
                </span>
                {member.isOwner && <Crown size={12} color="#fbbf24" />}
                {member.isMod && <Shield size={12} color="var(--accent)" />}
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
