import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Users, Settings, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, onSnapshot, query, where, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { hasPermission, PERMISSIONS, isServerOwner, isSuperAdmin } from '../utils/permissions';
import { appAlert, appConfirm } from '../utils/dialogService';
import { resolveAvatarUrl } from '../utils/avatarUrl';

export default function ServerSettingsModal({ isOpen, onClose, serverId }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [serverData, setServerData] = useState(null);
    const [roles, setRoles] = useState([]);
    const [members, setMembers] = useState([]); // In a real app, fetch this from a subcollection
    // For this MVP, we'll assume members are stored in the server doc or we just fetch all users (simplified)

    const [currentUserMember, setCurrentUserMember] = useState(null);
    const [memberLoaded, setMemberLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [iconUrlInput, setIconUrlInput] = useState('');
    const iconFileInputRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setActiveTab('overview');
    }, [isOpen, serverId]);

    useEffect(() => {
        setIconUrlInput(serverData?.icon || '');
    }, [serverData?.icon, isOpen]);

    useEffect(() => {
        if (!isOpen || !serverId || !currentUser) return;
        setMemberLoaded(false);

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
            setMemberLoaded(true);
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
    const isOwner = isServerOwner(currentUser, serverData);
    const isSuper = isSuperAdmin(currentUser);
    const canManageOverview = canManageServer || isOwner || isSuper;
    const canManageMembers = canManageRoles || canManageServer || isOwner || isSuper;
    const canViewSettings = isSuper || isOwner || !!currentUserMember;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Settings },
        ...(canManageRoles || isOwner || isSuper ? [{ id: 'roles', label: 'Roles', icon: Shield }] : []),
        ...(canManageMembers ? [{ id: 'members', label: 'Members', icon: Users }] : []),
    ];
    const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || 'Overview';

    useEffect(() => {
        if (!tabs.some(tab => tab.id === activeTab)) {
            setActiveTab('overview');
        }
    }, [activeTab, tabs]);

    if (!isOpen) return null;

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
        const confirmed = await appConfirm(
            "Are you sure you want to delete this server? This cannot be undone.",
            { title: 'Delete Server', confirmText: 'Delete Server', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;
        try {
            await deleteDoc(doc(db, "servers", serverId));
            onClose();
        } catch (error) {
            console.error("Error deleting server:", error);
            await appAlert("Failed to delete server.", { title: 'Delete Failed', danger: true });
        }
    };

    const handleGlobalBan = async (userId) => {
        // Only super admins can globally ban
        if (!isSuperAdmin(currentUser)) {
            await appAlert("Only Super Admins can globally ban users.", { title: 'Permission Denied' });
            return;
        }
        const confirmed = await appConfirm(
            "Globally ban this user from the entire app? They will not be able to log in.",
            { title: 'Global Ban', confirmText: 'Ban User', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;
        try {
            await updateDoc(doc(db, "users", userId), {
                globalBan: true
            });
            await appAlert("User globally banned.", { title: 'User Updated' });
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error banning user:", error);
            await appAlert("Failed to ban user.", { title: 'Ban Failed', danger: true });
        }
    };

    const handleRegenerateInvite = async () => {
        const confirmed = await appConfirm(
            "Regenerate invite code? The old code will stop working.",
            { title: 'Regenerate Invite', confirmText: 'Regenerate', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;
        try {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const values = crypto.getRandomValues(new Uint8Array(10));
            const newCode = Array.from(values, v => chars[v % chars.length]).join('');
            await updateDoc(doc(db, "servers", serverId), { inviteCode: newCode });
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error regenerating invite:", error);
            await appAlert("Failed to regenerate invite code.", { title: 'Invite Failed', danger: true });
        }
    };

    const copyInviteCode = () => {
        if (serverData?.inviteCode) {
            navigator.clipboard.writeText(serverData.inviteCode);
            void appAlert("Invite code copied!", { title: 'Copied' });
        }
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
    });

    const handleServerIconUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            await appAlert('Please upload an image file for the server icon.', { title: 'Invalid File', danger: true });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            await appAlert('Server icon must be under 2 MB.', { title: 'File Too Large', danger: true });
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setServerData((prev) => ({ ...(prev || {}), icon: dataUrl }));
            setIconUrlInput(dataUrl);
            await appAlert('Server icon updated in preview. Click Save to apply.', { title: 'Icon Ready' });
        } catch (_) {
            await appAlert('Failed to process server icon.', { title: 'Upload Failed', danger: true });
        } finally {
            event.target.value = '';
        }
    };

    const applyIconUrl = async () => {
        const trimmed = iconUrlInput.trim();
        if (!trimmed) {
            setServerData((prev) => ({ ...(prev || {}), icon: null }));
            return;
        }
        if (!/^https?:\/\//i.test(trimmed) && !/^data:image\//i.test(trimmed)) {
            await appAlert('Use a valid image URL (http/https) or a data URL.', { title: 'Invalid URL', danger: true });
            return;
        }
        setServerData((prev) => ({ ...(prev || {}), icon: trimmed }));
        await appAlert('Server icon URL applied in preview. Click Save to apply.', { title: 'Icon Ready' });
    };

    const removeServerIcon = () => {
        setServerData((prev) => ({ ...(prev || {}), icon: null }));
        setIconUrlInput('');
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
            zIndex: 12000,
            padding: isMobile ? '0' : '16px'
        }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={isMobile ? "" : "glass-panel liquid-panel"}
                style={{
                    width: isMobile ? '100%' : 'calc(100vw - 32px)',
                    maxWidth: isMobile ? '100%' : '800px',
                    height: isMobile ? '100%' : 'calc(100vh - 32px)',
                    maxHeight: isMobile ? '100%' : '600px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: isMobile ? '0' : '8px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-lg), 0 0 45px rgba(88, 101, 242, 0.15)',
                    border: isMobile ? 'none' : '1px solid var(--glass-border)',
                }}
            >
                {/* Sidebar */}
                <div style={{
                    width: isMobile ? '100%' : '200px',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: isMobile ? '12px' : '16px 8px',
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    gap: '4px',
                    overflowX: isMobile ? 'auto' : 'visible',
                    borderBottom: isMobile ? '1px solid var(--glass-border)' : 'none'
                }}>
                    {!isMobile && (
                        <div style={{ padding: '0 8px 16px', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {serverData?.name}
                        </div>
                    )}
                    {tabs.map(item => (
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
                                fontWeight: 500,
                                whiteSpace: 'nowrap'
                            }}
                            className="hover:bg-white/5"
                        >
                            <item.icon size={18} style={{ marginRight: '8px' }} />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: isMobile ? '16px' : '24px', flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                                {activeTabLabel}
                            </h2>
                            <button onClick={onClose} className="icon-btn"><X size={24} /></button>
                        </div>

                        {!serverData && (
                            <div style={{
                                padding: '20px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                fontSize: '14px'
                            }}>
                                Loading server settings...
                            </div>
                        )}

                        {serverData && memberLoaded && !canViewSettings && (
                            <div style={{
                                padding: '20px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-secondary)',
                                fontSize: '14px',
                                lineHeight: 1.5
                            }}>
                                You don't have permission to manage this server.
                            </div>
                        )}

                        {serverData && canViewSettings && activeTab === 'roles' && (
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

                        {serverData && canViewSettings && activeTab === 'members' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {members.map((member) => {
                                    const resolvedAvatar = resolveAvatarUrl(member.user.photoURL);
                                    const hasAvatar = !!resolvedAvatar;
                                    const fallbackInitial = (member.user.displayName || 'U').trim().charAt(0).toUpperCase();

                                    return (
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
                                                backgroundColor: 'var(--bg-secondary)',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--text-primary)',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                            }}>
                                                {hasAvatar ? (
                                                    <img
                                                        src={resolvedAvatar}
                                                        alt={member.user.displayName || 'User avatar'}
                                                        referrerPolicy="no-referrer"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    fallbackInitial || 'U'
                                                )}
                                            </div>
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
                                                        const confirmed = await appConfirm(
                                                            'Kick this user?',
                                                            { title: 'Kick Member', confirmText: 'Kick', cancelText: 'Cancel', danger: true }
                                                        );
                                                        if (!confirmed) return;
                                                        await deleteDoc(doc(db, "servers", serverId, "members", member.id));
                                                        // Also remove from their joinedServers if possible, but we can't easily access their doc without being admin usually.
                                                        // But we can try.
                                                        try {
                                                            await updateDoc(doc(db, "users", member.id), {
                                                                joinedServers: arrayRemove(serverId)
                                                            });
                                                        } catch (e) { console.error("Could not remove from user joinedServers", e); }
                                                    }}
                                                    style={{ color: 'var(--warning)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Kick
                                                </button>
                                            )}

                                            {(hasPermission(currentUser, serverData, currentUserMember, PERMISSIONS.BAN_MEMBERS) || isServerOwner(currentUser, serverData)) && (
                                                <button
                                                    onClick={async () => {
                                                        const confirmed = await appConfirm(
                                                            'Ban this user?',
                                                            { title: 'Ban Member', confirmText: 'Ban', cancelText: 'Cancel', danger: true }
                                                        );
                                                        if (!confirmed) return;
                                                        await updateDoc(doc(db, "servers", serverId), {
                                                            bannedUsers: arrayUnion(member.id)
                                                        });
                                                        await deleteDoc(doc(db, "servers", serverId, "members", member.id));
                                                        try {
                                                            await updateDoc(doc(db, "users", member.id), {
                                                                joinedServers: arrayRemove(serverId)
                                                            });
                                                        } catch (e) { console.error("Could not remove from user joinedServers", e); }
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
                                    );
                                })}
                            </div>
                        )}

                        {serverData && canViewSettings && activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {!canManageOverview && (
                                    <div style={{
                                        padding: '12px 14px',
                                        borderRadius: '8px',
                                        backgroundColor: 'rgba(250, 204, 21, 0.08)',
                                        border: '1px solid rgba(250, 204, 21, 0.25)',
                                        color: '#facc15',
                                        fontSize: '13px'
                                    }}>
                                        You can view this server, but only admins can change settings.
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                    <div style={{
                                        width: '100px',
                                        height: '100px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        backgroundImage: serverData?.icon ? `url(${serverData.icon})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '32px',
                                        fontWeight: 700,
                                        border: '1px solid var(--glass-border)',
                                        overflow: 'hidden',
                                    }}>
                                        {!serverData?.icon && serverData?.name?.[0]}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            SERVER ICON
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() => iconFileInputRef.current?.click()}
                                                disabled={!canManageOverview}
                                                style={{ padding: '6px 12px', fontSize: '12px', opacity: canManageOverview ? 1 : 0.6 }}
                                            >
                                                Upload Icon
                                            </button>
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={removeServerIcon}
                                                disabled={!canManageOverview}
                                                style={{ padding: '6px 12px', fontSize: '12px', opacity: canManageOverview ? 1 : 0.6 }}
                                            >
                                                Remove Icon
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                            <input
                                                type="text"
                                                value={iconUrlInput}
                                                onChange={(event) => setIconUrlInput(event.target.value)}
                                                placeholder="https://example.com/icon.png"
                                                disabled={!canManageOverview}
                                                style={{
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--glass-border)',
                                                    padding: '8px 10px',
                                                    borderRadius: '6px',
                                                    color: 'white',
                                                    flex: 1,
                                                    fontSize: '12px',
                                                    opacity: canManageOverview ? 1 : 0.7
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={applyIconUrl}
                                                disabled={!canManageOverview}
                                                style={{ padding: '6px 12px', fontSize: '12px', opacity: canManageOverview ? 1 : 0.6 }}
                                            >
                                                Apply URL
                                            </button>
                                        </div>
                                        <input
                                            ref={iconFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleServerIconUpload}
                                            style={{ display: 'none' }}
                                        />

                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            SERVER NAME
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                type="text"
                                                value={serverData?.name || ''}
                                                onChange={(e) => setServerData({ ...serverData, name: e.target.value.slice(0, 100) })}
                                                disabled={!canManageOverview}
                                                style={{
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--glass-border)',
                                                    padding: '10px',
                                                    borderRadius: '4px',
                                                    color: 'white',
                                                    flex: 1,
                                                    opacity: canManageOverview ? 1 : 0.7
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await updateDoc(doc(db, "servers", serverId), {
                                                            name: serverData.name,
                                                            description: serverData.description || '',
                                                            icon: serverData.icon || null
                                                        });
                                                        await appAlert("Server updated!", { title: 'Saved' });
                                                    } catch (e) {
                                                        if (import.meta.env.DEV) console.error("Error updating:", e);
                                                        await appAlert("Failed to update.", { title: 'Update Failed', danger: true });
                                                    }
                                                }}
                                                className="glossy-button"
                                                disabled={!canManageOverview}
                                                style={{ padding: '0 16px', opacity: canManageOverview ? 1 : 0.5, cursor: canManageOverview ? 'pointer' : 'not-allowed' }}
                                            >
                                                <Save size={18} />
                                            </button>
                                        </div>

                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', marginTop: '16px' }}>
                                            DESCRIPTION
                                        </label>
                                        <textarea
                                            value={serverData?.description || ''}
                                            onChange={(e) => setServerData({ ...serverData, description: e.target.value.slice(0, 500) })}
                                            placeholder="Describe your server..."
                                            rows={3}
                                            disabled={!canManageOverview}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--glass-border)',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                color: 'white',
                                                width: '100%',
                                                resize: 'none',
                                                fontFamily: 'inherit',
                                                fontSize: '14px',
                                                opacity: canManageOverview ? 1 : 0.7
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Invite Code Section */}
                                <div style={{
                                    backgroundColor: 'var(--bg-tertiary)',
                                    padding: '16px',
                                    borderRadius: '8px'
                                }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>
                                        INVITE CODE
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <code style={{
                                            flex: 1,
                                            padding: '12px',
                                            backgroundColor: 'var(--bg-primary)',
                                            borderRadius: '4px',
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            letterSpacing: '2px',
                                            textAlign: 'center',
                                            color: 'var(--accent)'
                                        }}>
                                            {serverData?.inviteCode || 'N/A'}
                                        </code>
                                        <button
                                            onClick={copyInviteCode}
                                            className="glossy-button"
                                            style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={handleRegenerateInvite}
                                            disabled={!canManageOverview}
                                            style={{
                                                padding: '10px 16px',
                                                background: 'transparent',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '8px',
                                                color: 'var(--text-secondary)',
                                                cursor: canManageOverview ? 'pointer' : 'not-allowed',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                opacity: canManageOverview ? 1 : 0.5
                                            }}
                                        >
                                            Regenerate
                                        </button>
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
