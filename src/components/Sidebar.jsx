import { useState, useEffect } from 'react';
import { Plus, MessageCircle, Settings, Compass, LogOut, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, where, documentId, deleteDoc, updateDoc, arrayRemove, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import CreateServerModal from './CreateServerModal';
import ServerSettingsModal from './ServerSettingsModal';
import ServerBrowser from './ServerBrowser';
import SuperAdminModal from './SuperAdminModal';
import UpdateCenterModal from './UpdateCenterModal';
import { isSuperAdmin, isServerOwner, isUpdateCenterUser } from '../utils/permissions';

import serverPlaceholder from '../assets/server_placeholder.png';

const ServerIcon = ({ icon, name, active, onClick, index, children, onContextMenu, isMobile, showLabel }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                delay: index * 0.05,
                type: "spring",
                stiffness: 300,
                damping: 20
            }}
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '72px' : '48px',
                marginBottom: isMobile ? 0 : '8px',
                cursor: 'pointer',
                gap: isMobile ? '6px' : 0
            }}
        >
            {/* Active Indicator (desktop only) */}
            {!isMobile && (
                <motion.div
                    animate={{
                        height: active ? '40px' : '8px',
                        opacity: active ? 1 : 0
                    }}
                    style={{
                        position: 'absolute',
                        left: '-16px',
                        width: '4px',
                        backgroundColor: 'white',
                        borderRadius: '0 4px 4px 0',
                    }}
                />
            )}

            <motion.div
                whileHover={{ borderRadius: '16px', scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                    borderRadius: active ? '16px' : '50%',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                    width: isMobile ? '56px' : '48px',
                    height: isMobile ? '56px' : '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    overflow: 'hidden',
                    transition: 'background-color 0.2s',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: 700,
                    backgroundImage: children ? 'none' : `url(${icon || serverPlaceholder})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: children ? (active ? 'var(--accent)' : 'var(--bg-tertiary)') : 'var(--bg-tertiary)',
                    border: active ? '2px solid var(--accent)' : '2px solid transparent',
                    boxShadow: active ? '0 0 20px var(--accent-glow)' : 'none'
                }}
            >
                {children ? children : (!icon && name?.substring(0, 2).toUpperCase())}
            </motion.div>

            {/* Label for mobile */}
            {isMobile && showLabel && (
                <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '72px'
                }}>
                    {name?.length > 8 ? name.substring(0, 7) + '...' : name}
                </span>
            )}
        </motion.div>
    );
};

export default function Sidebar({ activeServerId, setActiveServerId, isMobileView }) {
    const [servers, setServers] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsServerId, setSettingsServerId] = useState(null);
    const [isUpdateCenterOpen, setIsUpdateCenterOpen] = useState(false);
    const [updateCenterEmails, setUpdateCenterEmails] = useState([]);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser?.joinedServers || currentUser.joinedServers.length === 0) {
            setServers([]);
            return;
        }

        // Limit to 30 for now to fit 'in' query limit
        const safeIds = currentUser.joinedServers.slice(0, 30);
        const q = query(collection(db, "servers"), where(documentId(), "in", safeIds));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const srvs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort manually
            srvs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setServers(srvs);
        });

        return () => unsubscribe();
    }, [JSON.stringify(currentUser?.joinedServers)]);

    const handleContextMenu = (e, serverId) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, serverId });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        const unsubscribe = onSnapshot(
            doc(db, 'updateCenter', 'config'),
            (snap) => {
                if (snap.exists()) {
                    setUpdateCenterEmails(snap.data().authorizedEmails || []);
                } else {
                    setUpdateCenterEmails([]);
                }
            },
            () => setUpdateCenterEmails([])
        );
        return () => unsubscribe();
    }, [currentUser?.uid]);

    const handleLeaveServer = async (serverId) => {
        if (!confirm("Are you sure you want to leave this server?")) return;

        try {
            // Check if owner
            const serverDoc = await getDoc(doc(db, "servers", serverId));
            if (serverDoc.exists() && isServerOwner(currentUser, serverDoc.data())) {
                alert("You cannot leave a server you own. Please delete it or transfer ownership first.");
                return;
            }

            // 1. Remove from server members
            await deleteDoc(doc(db, "servers", serverId, "members", currentUser.uid));

            // 2. Remove from user's joinedServers
            await updateDoc(doc(db, "users", currentUser.uid), {
                joinedServers: arrayRemove(serverId)
            });

            setActiveServerId('home');
            setContextMenu(null);
        } catch (error) {
            console.error("Error leaving server:", error);
            alert("Failed to leave server.");
        }
    };

    // Mobile grid layout
    if (isMobileView) {
        return (
            <div style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                {/* Quick Actions */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px'
                }}>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsBrowserOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            gridColumn: '1 / -1' // Full width
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Compass size={20} color="#3b82f6" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Discover</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Find communities</div>
                        </div>
                    </motion.button>

                    {isSuperAdmin(currentUser) && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsSuperAdminOpen(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                gridColumn: '1 / -1'
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Settings size={20} color="white" />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Super Admin</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Global control</div>
                            </div>
                        </motion.button>
                    )}

                    {isUpdateCenterUser(currentUser, updateCenterEmails) && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsUpdateCenterOpen(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                gridColumn: '1 / -1'
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <GitBranch size={20} color="white" />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Update Center</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Deploy new version</div>
                            </div>
                        </motion.button>
                    )}

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveServerId('home')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px',
                            backgroundColor: activeServerId === 'home' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                            border: activeServerId === 'home' ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            color: activeServerId === 'home' ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MessageCircle size={20} color="white" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Messages</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Direct chats</div>
                        </div>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCreateModalOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Plus size={20} color="var(--success)" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Create</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>New server</div>
                        </div>
                    </motion.button>
                </div>

                {/* Servers Grid */}
                {servers.length > 0 && (
                    <>
                        <h3 style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            margin: '8px 0 0'
                        }}>
                            Your Servers
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: '12px'
                        }}>
                            {servers.map((server, index) => (
                                <motion.button
                                    key={server.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setActiveServerId(server.id)}
                                    onContextMenu={(e) => handleContextMenu(e, server.id)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '16px 12px',
                                        backgroundColor: activeServerId === server.id ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                                        border: activeServerId === server.id ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        color: 'var(--text-primary)',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: '52px',
                                        height: '52px',
                                        borderRadius: '16px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        backgroundImage: server.icon ? `url(${server.icon})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {!server.icon && server.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span style={{
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '100%',
                                        color: activeServerId === server.id ? 'var(--accent)' : 'var(--text-primary)'
                                    }}>
                                        {server.name}
                                    </span>
                                    {activeServerId === server.id && (
                                        <motion.div
                                            layoutId="activeServer"
                                            style={{
                                                position: 'absolute',
                                                bottom: '-1px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: '40px',
                                                height: '3px',
                                                backgroundColor: 'var(--accent)',
                                                borderRadius: '3px 3px 0 0'
                                            }}
                                        />
                                    )}

                                    {/* Mobile Settings Button */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSettingsServerId(server.id);
                                            setIsSettingsOpen(true);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            padding: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backdropFilter: 'blur(4px)'
                                        }}
                                    >
                                        <Settings size={14} />
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </>
                )}

                {servers.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <Settings size={28} />
                        </div>
                        <p>No servers yet</p>
                        <p style={{ fontSize: '13px' }}>Create one to get started!</p>
                    </div>
                )}

                <CreateServerModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                />

                <ServerSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    serverId={settingsServerId}
                />

                <ServerBrowser
                    isOpen={isBrowserOpen}
                    onClose={() => setIsBrowserOpen(false)}
                    onJoinServer={(serverId) => setActiveServerId(serverId)}
                    isMobile={isMobileView}
                />

                <SuperAdminModal
                    isOpen={isSuperAdminOpen}
                    onClose={() => setIsSuperAdminOpen(false)}
                    isMobile={true}
                />

                <UpdateCenterModal
                    isOpen={isUpdateCenterOpen}
                    onClose={() => setIsUpdateCenterOpen(false)}
                    isMobile={true}
                />

                {/* Context Menu */}
                <AnimatePresence>
                    {contextMenu && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{
                                position: 'fixed',
                                top: contextMenu.y,
                                left: contextMenu.x,
                                backgroundColor: 'var(--bg-secondary)',
                                padding: '8px',
                                borderRadius: '12px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                border: '1px solid var(--glass-border)',
                                zIndex: 2000,
                                minWidth: '160px'
                            }}
                        >
                            <button
                                onClick={() => {
                                    setSettingsServerId(contextMenu.serverId);
                                    setIsSettingsOpen(true);
                                    setContextMenu(null);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    borderRadius: '8px'
                                }}
                            >
                                <Settings size={16} />
                                Server Settings
                            </button>

                            <button
                                onClick={() => handleLeaveServer(contextMenu.serverId)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--error)',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    borderRadius: '8px'
                                }}
                            >
                                <LogOut size={16} />
                                Leave Server
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Desktop sidebar layout
    return (
        <div style={{
            width: '72px',
            height: '100vh',
            backgroundColor: '#0b0d0e',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 0',
            gap: '8px',
            borderRight: '1px solid var(--glass-border)',
            overflowY: 'auto',
            overflowX: 'hidden'
        }}>
            {/* Home Icon */}
            <ServerIcon
                name="Direct Messages"
                active={activeServerId === 'home'}
                onClick={() => setActiveServerId('home')}
                index={0}
            >
                <img src="https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Home" style={{ width: '28px', height: '28px' }} />
            </ServerIcon>

            <div style={{
                width: '32px',
                height: '2px',
                backgroundColor: 'var(--glass-border)',
                margin: '4px 0',
                flexShrink: 0
            }} />

            {/* Server List */}
            <AnimatePresence>
                {servers.map((server, index) => (
                    <ServerIcon
                        key={server.id}
                        icon={server.icon}
                        name={server.name}
                        active={activeServerId === server.id}
                        onClick={() => setActiveServerId(server.id)}
                        onContextMenu={(e) => handleContextMenu(e, server.id)}
                        index={index + 1}
                    />
                ))}
            </AnimatePresence>

            <ServerIcon
                name="Add a Server"
                active={false}
                onClick={() => setIsCreateModalOpen(true)}
                index={servers.length + 1}
            >
                <Plus size={24} color="#23a559" />
            </ServerIcon>

            <ServerIcon
                name="Discover Servers"
                active={false}
                onClick={() => setIsBrowserOpen(true)}
                index={servers.length + 2}
            >
                <Compass size={24} color="#dbdee1" />
            </ServerIcon>

            {isSuperAdmin(currentUser) && (
                <ServerIcon
                    name="Super Admin"
                    active={false}
                    onClick={() => setIsSuperAdminOpen(true)}
                    index={servers.length + 3}
                >
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Settings size={24} color="white" />
                    </div>
                </ServerIcon>
            )}

            {isUpdateCenterUser(currentUser, updateCenterEmails) && (
                <ServerIcon
                    name="Update Center"
                    active={false}
                    onClick={() => setIsUpdateCenterOpen(true)}
                    index={servers.length + 4}
                >
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <GitBranch size={24} color="white" />
                    </div>
                </ServerIcon>
            )}

            <CreateServerModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            <ServerSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                serverId={settingsServerId}
            />

            <ServerBrowser
                isOpen={isBrowserOpen}
                onClose={() => setIsBrowserOpen(false)}
                onJoinServer={(serverId) => setActiveServerId(serverId)}
                isMobile={false}
            />

            <SuperAdminModal
                isOpen={isSuperAdminOpen}
                onClose={() => setIsSuperAdminOpen(false)}
            />

            <UpdateCenterModal
                isOpen={isUpdateCenterOpen}
                onClose={() => setIsUpdateCenterOpen(false)}
            />

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '8px',
                            borderRadius: '12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            border: '1px solid var(--glass-border)',
                            zIndex: 2000,
                            minWidth: '160px'
                        }}
                    >
                        <button
                            onClick={() => {
                                setSettingsServerId(contextMenu.serverId);
                                setIsSettingsOpen(true);
                                setContextMenu(null);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '10px 12px',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                borderRadius: '8px'
                            }}
                        >
                            <Settings size={16} />
                            Server Settings
                        </button>

                        <button
                            onClick={() => handleLeaveServer(contextMenu.serverId)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '10px 12px',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                borderRadius: '8px'
                            }}
                        >
                            <LogOut size={16} />
                            Leave Server
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
