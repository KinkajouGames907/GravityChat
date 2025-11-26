import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Users, Settings, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, onSnapshot, query, where, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { hasPermission, PERMISSIONS, isServerOwner, isSuperAdmin } from '../utils/permissions';

export default function ServerSettingsModal({ isOpen, onClose, serverId }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [serverData, setServerData] = useState(null);
    const [roles, setRoles] = useState([]);
    const [members, setMembers] = useState([]); // In a real app, fetch this from a subcollection
    // For this MVP, we'll assume members are stored in the server doc or we just fetch all users (simplified)

    const [currentUserMember, setCurrentUserMember] = useState(null);

    useEffect(() => {
        if (!isOpen || !serverId || !currentUser) return;

        // Fetch Server Data
        const unsubscribeServer = onSnapshot(doc(db, "servers", serverId), (doc) => {
            if (doc.exists()) {
                setServerData(doc.data());
                setRoles(doc.data().roles || []);
            }
        });

        // Fetch Members if active tab is members
        let unsubscribeMembers = () => { };
        if (activeTab === 'members') {
            const q = query(collection(db, "servers", serverId, "members"));
            unsubscribeMembers = onSnapshot(q, async (snapshot) => {
                const promises = snapshot.docs.map(async (docSnap) => {
                    const userDoc = await getDoc(doc(db, "users", docSnap.id));
                    return {
                        id: docSnap.id,
                        ...docSnap.data(),
                        user: userDoc.exists() ? userDoc.data() : { displayName: 'Unknown', photoURL: null, email: 'unknown' }
                    };
                });
                const results = await Promise.all(promises);
                setMembers(results);
            });
        }

        // Fetch Current User's Member Data
        const fetchMember = async () => {
            const memberDoc = await getDoc(doc(db, "servers", serverId, "members", currentUser.uid));
            if (memberDoc.exists()) {
                setCurrentUserMember(memberDoc.data());
            } else {
                setCurrentUserMember(null);
            }
        };
        fetchMember();

        return () => {
            unsubscribeServer();
            unsubscribeMembers();
        };
    }, [isOpen, serverId, currentUser, activeTab]);

    // Permission Check
    const canManageServer = hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.MANAGE_SERVER);
    const canManageRoles = hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.MANAGE_ROLES);

    if (!isOpen) return null;

    // If data is loading or user has no permission to view settings
    if (serverData && !canManageServer && !isServerOwner(currentUser, serverData) && !isSuperAdmin(currentUser)) {
        return null; // Or show "Access Denied"
    }

    const handleCreateRole = async () => {
        const newRole = {
            id: Date.now().toString(),
            name: 'New Role',
            color: '#99aab5',
            permissions: []
        };
        try {
            await updateDoc(doc(db, "servers", serverId), {
                roles: arrayUnion(newRole)
            });
        } catch (err) {
            console.error("Error creating role:", err);
        }
    };

    const handleUpdateRole = async (updatedRole) => {
        const newRoles = roles.map(r => r.id === updatedRole.id ? updatedRole : r);
        try {
            await updateDoc(doc(db, "servers", serverId), { roles: newRoles });
        } catch (err) {
            console.error("Error updating role:", err);
        }
    };

    const handleDeleteRole = async (role) => {
        try {
            await updateDoc(doc(db, "servers", serverId), {
                roles: arrayRemove(role)
            });
        } catch (err) {
            console.error("Error deleting role:", err);
        }
    };

    const handleDeleteServer = async () => {
        if (!confirm("Are you sure you want to delete this server? This cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, "servers", serverId));
            onClose();
        } catch (error) {
            console.error("Error deleting server:", error);
            alert("Failed to delete server");
        }
    };

    const handleGlobalBan = async (userId) => {
        if (!confirm("Globally ban this user from the entire app? They will not be able to log in.")) return;
        try {
            await updateDoc(doc(db, "users", userId), {
                globalBan: true
            });
            alert("User globally banned.");
        } catch (error) {
            console.error("Error banning user:", error);
            alert("Failed to ban user.");
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                    width: '800px',
                    height: '600px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '8px',
                    display: 'flex',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}
            >
                {/* Sidebar */}
                <div style={{
                    width: '200px',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '16px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ padding: '0 8px 16px', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {serverData?.name}
                    </div>
                    {[
                        { id: 'overview', label: 'Overview', icon: Settings },
                        { id: 'roles', label: 'Roles', icon: Shield },
                        { id: 'members', label: 'Members', icon: Users },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: 'none',
                                background: activeTab === item.id ? 'var(--bg-hover)' : 'transparent',
                                color: activeTab === item.id ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                                fontWeight: 500
                            }}
                            className="hover:bg-white/5"
                        >
                            <item.icon size={18} style={{ marginRight: '8px' }} />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                < div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            </h2>
                            <button onClick={onClose} className="icon-btn"><X size={24} /></button>
                        </div>

                        {activeTab === 'roles' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        Use roles to group server members and assign permissions.
                                    </div>
                                    <button
                                        className="glossy-button"
                                        style={{ padding: '6px 12px', fontSize: '13px' }}
                                        onClick={handleCreateRole}
                                    >
                                        Create Role
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {roles.map((role, index) => (
                                        <div key={role.id} style={{
                                            backgroundColor: 'var(--bg-tertiary)',
                                            padding: '16px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    backgroundColor: role.color
                                                }} />

                                                <div style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        value={role.name}
                                                        onChange={(e) => handleUpdateRole({ ...role, name: e.target.value })}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: 'white',
                                                            fontWeight: 700,
                                                            fontSize: '15px'
                                                        }}
                                                    />
                                                </div>

                                                <input
                                                    type="color"
                                                    value={role.color}
                                                    onChange={(e) => handleUpdateRole({ ...role, color: e.target.value })}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        width: '32px',
                                                        height: '32px',
                                                        cursor: 'pointer'
                                                    }}
                                                />

                                                <button
                                                    onClick={() => handleDeleteRole(role)}
                                                    className="icon-btn"
                                                    style={{ color: 'var(--error)' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            {/* Permissions */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {Object.keys(PERMISSIONS).map(perm => (
                                                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={role.permissions?.includes(perm)}
                                                            onChange={(e) => {
                                                                const newPerms = e.target.checked
                                                                    ? [...(role.permissions || []), perm]
                                                                    : (role.permissions || []).filter(p => p !== perm);
                                                                handleUpdateRole({ ...role, permissions: newPerms });
                                                            }}
                                                        />
                                                        {perm.replace('_', ' ')}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {members.map(member => (
                                    <div key={member.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                backgroundImage: `url(${member.user.photoURL})`,
                                                backgroundSize: 'cover',
                                                backgroundColor: '#5865f2'
                                            }} />
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'white' }}>{member.user.displayName}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {member.roles?.map(rId => roles.find(r => r.id === rId)?.name).join(', ') || 'No Roles'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {/* Role Assignment - Simplified for MVP: Cycle through roles or just show a select */}
                                            <select
                                                value={member.roles?.[0] || ''}
                                                onChange={async (e) => {
                                                    const newRole = e.target.value;
                                                    await updateDoc(doc(db, "servers", serverId, "members", member.id), {
                                                        roles: newRole ? [newRole] : []
                                                    });
                                                }}
                                                style={{
                                                    background: 'var(--bg-secondary)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px'
                                                }}
                                                disabled={!canManageRoles && !isServerOwner(currentUser, serverData)}
                                            >
                                                <option value="">No Role</option>
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>

                                            {(hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.KICK_MEMBERS) || isServerOwner(currentUser, serverData)) && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Kick this user?')) {
                                                            await deleteDoc(doc(db, "servers", serverId, "members", member.id));
                                                            // Also remove from their joinedServers if possible, but we can't easily access their doc without being admin usually.
                                                            // But we can try.
                                                            try {
                                                                await updateDoc(doc(db, "users", member.id), {
                                                                    joinedServers: arrayRemove(serverId)
                                                                });
                                                            } catch (e) { console.error("Could not remove from user joinedServers", e); }
                                                        }
                                                    }}
                                                    style={{ color: 'var(--warning)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Kick
                                                </button>
                                            )}

                                            {(hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.BAN_MEMBERS) || isServerOwner(currentUser, serverData)) && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Ban this user?')) {
                                                            await updateDoc(doc(db, "servers", serverId), {
                                                                bannedUsers: arrayUnion(member.id)
                                                            });
                                                            await deleteDoc(doc(db, "servers", serverId, "members", member.id));
                                                            try {
                                                                await updateDoc(doc(db, "users", member.id), {
                                                                    joinedServers: arrayRemove(serverId)
                                                                });
                                                            } catch (e) { console.error("Could not remove from user joinedServers", e); }
                                                        }
                                                    }}
                                                    style={{ color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Ban
                                                </button>
                                            )}

                                            {isSuperAdmin(currentUser) && (
                                                <button
                                                    onClick={() => handleGlobalBan(member.id)}
                                                    style={{ color: 'var(--error)', background: 'rgba(255, 0, 0, 0.1)', border: '1px solid var(--error)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    GLOBAL BAN
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div style={{
                                        width: '100px',
                                        height: '100px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '32px',
                                        fontWeight: 700
                                    }}>
                                        {serverData?.name?.[0]}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            SERVER NAME
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                type="text"
                                                value={serverData?.name || ''}
                                                onChange={(e) => setServerData({ ...serverData, name: e.target.value })}
                                                style={{
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--glass-border)',
                                                    padding: '10px',
                                                    borderRadius: '4px',
                                                    color: 'white',
                                                    width: '300px'
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await updateDoc(doc(db, "servers", serverId), {
                                                            name: serverData.name
                                                        });
                                                        alert("Server name updated!");
                                                    } catch (e) {
                                                        console.error("Error updating name:", e);
                                                        alert("Failed to update name.");
                                                    }
                                                }}
                                                className="glossy-button"
                                                style={{ padding: '0 16px' }}
                                            >
                                                <Save size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {(isServerOwner(currentUser, serverData) || isSuperAdmin(currentUser)) && (
                                    <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
                                        <h3 style={{ color: 'var(--error)', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Danger Zone</h3>
                                        <button
                                            onClick={handleDeleteServer}
                                            style={{
                                                backgroundColor: 'var(--error)',
                                                color: 'white',
                                                border: 'none',
                                                padding: '10px 16px',
                                                borderRadius: '4px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Delete Server
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div >
            </motion.div >
        </div >,
        document.body
    );
}
