import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Users, Settings, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, onSnapshot } from 'firebase/firestore';

export default function ServerSettingsModal({ isOpen, onClose, serverId }) {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [serverData, setServerData] = useState(null);
    const [roles, setRoles] = useState([]);
    const [members, setMembers] = useState([]); // In a real app, fetch this from a subcollection
    // For this MVP, we'll assume members are stored in the server doc or we just fetch all users (simplified)

    useEffect(() => {
        if (!isOpen || !serverId) return;

        const unsubscribe = onSnapshot(doc(db, "servers", serverId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setServerData(data);
                setRoles(data.roles || []);
            }
        });
        return unsubscribe;
    }, [isOpen, serverId]);

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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                                            alignItems: 'center',
                                            gap: '16px'
                                        }}>
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
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>
                                Member management coming soon.
                            </div>
                        )}

                        {activeTab === 'overview' && (
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
                                    <input
                                        type="text"
                                        value={serverData?.name || ''}
                                        readOnly
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            border: 'none',
                                            padding: '10px',
                                            borderRadius: '4px',
                                            color: 'white',
                                            width: '300px'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
