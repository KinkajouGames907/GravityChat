import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Crown, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, orderBy } from 'firebase/firestore';
import UserProfileModal from './UserProfileModal';
import { useEmoji } from '../context/EmojiContext';
import { resolveAvatarUrl } from '../utils/avatarUrl';

const OWNER_GROUP_ID = '__owner';

const getStatusColor = (status) => {
    switch (status) {
        case 'online': return 'var(--success)';
        case 'idle': return '#eab308';
        case 'dnd': return 'var(--danger)';
        default: return 'var(--text-muted)';
    }
};

const getStatusRank = (status) => {
    switch (status) {
        case 'online': return 0;
        case 'idle': return 1;
        case 'dnd': return 2;
        case 'offline': return 3;
        default: return 4;
    }
};

const sortMembers = (a, b) => {
    const statusDiff = getStatusRank(a.status) - getStatusRank(b.status);
    if (statusDiff !== 0) return statusDiff;
    const aName = (a.displayName || '').toLowerCase();
    const bName = (b.displayName || '').toLowerCase();
    return aName.localeCompare(bName);
};

const getPresenceStatus = (userData = {}) => {
    const lastSeen = userData?.lastSeen?.toDate?.() || null;
    const isOnline = !!lastSeen && (Date.now() - lastSeen.getTime()) < 2 * 60 * 1000;
    if (!isOnline) return 'offline';

    const status = userData.status || 'online';
    return status === 'invisible' ? 'offline' : status;
};

function normalizeRole(role, fallbackId, fallbackPosition = 0) {
    return {
        id: String(role?.id ?? fallbackId),
        name: role?.name || 'Role',
        color: role?.color || null,
        position: Number.isFinite(role?.position) ? role.position : fallbackPosition,
        permissions: Array.isArray(role?.permissions) ? role.permissions : [],
    };
}

export default function MemberList({ serverId }) {
    const [members, setMembers] = useState([]);
    const [serverRoles, setServerRoles] = useState([]);
    const [roleDocs, setRoleDocs] = useState([]);
    const [serverOwnerId, setServerOwnerId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [collapsedRoles, setCollapsedRoles] = useState({});

    // Fetch server doc (primary source of roles + owner)
    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        const unsubscribe = onSnapshot(doc(db, 'servers', serverId), (snapshot) => {
            if (!snapshot.exists()) {
                setServerRoles([]);
                setServerOwnerId(null);
                return;
            }

            const data = snapshot.data();
            setServerOwnerId(data.ownerId || null);

            const rolesFromDoc = Array.isArray(data.roles)
                ? data.roles.map((role, index) => normalizeRole(role, `role-${index}`, index))
                : [];

            setServerRoles(rolesFromDoc);
        });

        return unsubscribe;
    }, [serverId]);

    // Fetch role subcollection (fallback/legacy source)
    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        const q = query(collection(db, 'servers', serverId, 'roles'), orderBy('position', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rolesFromDocs = snapshot.docs.map((roleDoc, index) =>
                normalizeRole({ id: roleDoc.id, ...roleDoc.data() }, roleDoc.id, index)
            );
            setRoleDocs(rolesFromDocs);
        }, () => {
            setRoleDocs([]);
        });

        return unsubscribe;
    }, [serverId]);

    // Merge and sort roles (server doc wins when same id exists)
    const roles = useMemo(() => {
        const merged = new Map();

        serverRoles.forEach((role, index) => {
            merged.set(role.id, {
                ...role,
                position: Number.isFinite(role.position) ? role.position : index,
            });
        });

        const offset = serverRoles.length;
        roleDocs.forEach((role, index) => {
            const existing = merged.get(role.id);
            if (existing) {
                merged.set(role.id, {
                    ...role,
                    ...existing,
                    position: Number.isFinite(existing.position)
                        ? existing.position
                        : (Number.isFinite(role.position) ? role.position : index + offset),
                });
                return;
            }

            merged.set(role.id, {
                ...role,
                position: Number.isFinite(role.position) ? role.position : index + offset,
            });
        });

        return Array.from(merged.values()).sort((a, b) => {
            const posA = Number.isFinite(a.position) ? a.position : 9999;
            const posB = Number.isFinite(b.position) ? b.position : 9999;
            if (posA !== posB) return posA - posB;
            return String(a.name).localeCompare(String(b.name));
        });
    }, [serverRoles, roleDocs]);

    // Fetch members
    useEffect(() => {
        if (!serverId || serverId === 'home') return;

        const q = query(collection(db, 'servers', serverId, 'members'));
        const memberDataMap = new Map();
        const userDataMap = new Map();
        const userUnsubscribes = new Map();

        const rebuildMembers = () => {
            const nextMembers = [];
            memberDataMap.forEach((memberData, uid) => {
                const userData = userDataMap.get(uid) || {};
                const resolvedDisplayName = userData.displayName || memberData.displayName || 'Unknown';
                const resolvedPhotoURL = userData.photoURL || memberData.photoURL || '';

                nextMembers.push({
                    uid,
                    ...memberData,
                    ...userData,
                    displayName: resolvedDisplayName,
                    photoURL: resolvedPhotoURL,
                    status: getPresenceStatus(userData),
                });
            });

            setMembers(nextMembers);
        };

        const unsubscribeMembers = onSnapshot(q, (snapshot) => {
            const activeIds = new Set();

            snapshot.docs.forEach((memberDoc) => {
                const uid = memberDoc.id;
                activeIds.add(uid);
                memberDataMap.set(uid, memberDoc.data());

                if (!userUnsubscribes.has(uid)) {
                    const unsubscribeUser = onSnapshot(
                        doc(db, 'users', uid),
                        (userSnapshot) => {
                            if (userSnapshot.exists()) {
                                userDataMap.set(uid, userSnapshot.data());
                            } else {
                                userDataMap.delete(uid);
                            }
                            rebuildMembers();
                        },
                        () => {
                            userDataMap.delete(uid);
                            rebuildMembers();
                        }
                    );
                    userUnsubscribes.set(uid, unsubscribeUser);
                }
            });

            [...userUnsubscribes.keys()].forEach((uid) => {
                if (activeIds.has(uid)) return;
                userUnsubscribes.get(uid)?.();
                userUnsubscribes.delete(uid);
                memberDataMap.delete(uid);
                userDataMap.delete(uid);
            });

            rebuildMembers();
        }, () => {
            setMembers([]);
        });

        return () => {
            unsubscribeMembers();
            userUnsubscribes.forEach((unsubscribeUser) => unsubscribeUser());
        };
    }, [serverId]);

    const toggleRoleCollapse = (roleId) => {
        setCollapsedRoles((prev) => ({ ...prev, [roleId]: !prev[roleId] }));
    };

    const memberGroups = useMemo(() => {
        const roleGroupMap = new Map(roles.map((role) => [role.id, { role, members: [] }]));
        const uncategorized = { online: [], offline: [] };
        const ownerMembers = [];
        const queryValue = searchQuery.trim().toLowerCase();

        members.forEach((member) => {
            if (queryValue && !member.displayName?.toLowerCase().includes(queryValue)) {
                return;
            }

            if (serverOwnerId && member.uid === serverOwnerId) {
                ownerMembers.push(member);
                return;
            }

            const memberRoleIds = Array.isArray(member.roles) ? member.roles : [];
            const highestRole = roles.find((role) => memberRoleIds.includes(role.id));

            if (highestRole && roleGroupMap.has(highestRole.id)) {
                roleGroupMap.get(highestRole.id).members.push(member);
                return;
            }

            if (member.status === 'offline') {
                uncategorized.offline.push(member);
            } else {
                uncategorized.online.push(member);
            }
        });

        const roleGroups = Array.from(roleGroupMap.values())
            .map((group) => ({ ...group, members: [...group.members].sort(sortMembers) }))
            .filter((group) => group.members.length > 0);

        return {
            ownerMembers: ownerMembers.sort(sortMembers),
            roleGroups,
            uncategorized: {
                online: uncategorized.online.sort(sortMembers),
                offline: uncategorized.offline.sort(sortMembers),
            },
        };
    }, [members, roles, searchQuery, serverOwnerId]);

    const { ownerMembers, roleGroups, uncategorized } = memberGroups;

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
                        onChange={(event) => setSearchQuery(event.target.value)}
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
                {/* Owner Group */}
                {ownerMembers.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div
                            onClick={() => toggleRoleCollapse(OWNER_GROUP_ID)}
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
                            {collapsedRoles[OWNER_GROUP_ID] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                            <Crown size={12} color="#fbbf24" />
                            <span style={{ color: '#fbbf24' }}>Owner</span>
                            <span>— {ownerMembers.length}</span>
                        </div>

                        {!collapsedRoles[OWNER_GROUP_ID] && (
                            <div>
                                {ownerMembers.map((member, index) => (
                                    <MemberItem
                                        key={member.uid}
                                        member={member}
                                        index={index}
                                        onClick={setSelectedUser}
                                        roleColor="#fbbf24"
                                        showOwnerBadge
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Role Groups */}
                {roleGroups.map((group) => {
                    const { role, members: roleMembers } = group;
                    const roleNameLower = role.name.toLowerCase();
                    const showShield = roleNameLower.includes('admin') || roleNameLower.includes('mod');

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
                                        <MemberItem
                                            key={member.uid}
                                            member={member}
                                            index={index}
                                            onClick={setSelectedUser}
                                            roleColor={role.color}
                                            showShield={showShield}
                                        />
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

const MemberItem = ({ member, index, onClick, roleColor, showOwnerBadge = false, showShield = false }) => {
    const { customEmojis } = useEmoji();
    const [avatarError, setAvatarError] = useState(false);
    const resolvedPhotoURL = resolveAvatarUrl(member.photoURL);

    useEffect(() => {
        setAvatarError(false);
    }, [resolvedPhotoURL]);

    const hasPhoto = !!resolvedPhotoURL && !avatarError;
    const fallbackInitial = (member.displayName || member.email || 'U').trim().charAt(0).toUpperCase();

    const renderTextWithEmojis = (text) => {
        if (!text) return null;
        const parts = text.split(/(:[a-zA-Z0-9_]+:)/g);
        return parts.map((part, partIndex) => {
            if (customEmojis[part]) {
                return (
                    <img
                        key={partIndex}
                        src={customEmojis[part]}
                        alt={part}
                        title={part}
                        style={{
                            width: '14px',
                            height: '14px',
                            verticalAlign: 'middle',
                            margin: '0 1px',
                            objectFit: 'contain'
                        }}
                    />
                );
            }
            return part;
        });
    };

    return (
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
                    background: hasPhoto ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #2f343c, #6b7280)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 700
                }}>
                    {hasPhoto ? (
                        <img
                            src={resolvedPhotoURL}
                            alt={member.displayName || 'User avatar'}
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarError(true)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        fallbackInitial || 'U'
                    )}
                </div>
                {member.status !== 'offline' && (
                    <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(member.status),
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
                    {(showOwnerBadge || member.isOwner) && <Crown size={12} color="#fbbf24" />}
                    {!(showOwnerBadge || member.isOwner) && (showShield || member.isMod) && <Shield size={12} color="var(--accent)" />}
                </div>
                {member.customStatus && (
                    <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {renderTextWithEmojis(member.customStatus)}
                    </div>
                )}
            </div>
        </motion.div>
    );
};
