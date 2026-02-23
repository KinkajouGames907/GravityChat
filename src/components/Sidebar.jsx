import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, MessageCircle, Settings, Compass, LogOut, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, where, documentId, orderBy, onSnapshot, doc, deleteDoc, updateDoc, arrayRemove, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import CreateServerModal from './CreateServerModal';
import ServerSettingsModal from './ServerSettingsModal';
import ServerBrowser from './ServerBrowser';
import SuperAdminModal from './SuperAdminModal';
import UpdateCenterModal from './UpdateCenterModal';
import { isSuperAdmin, isServerOwner, isUpdateCenterUser } from '../utils/permissions';
import serverPlaceholder from '../assets/server_placeholder.png';
import { appAlert, appConfirm } from '../utils/dialogService';

const CONTEXT_MENU_WIDTH = 190;
const CONTEXT_MENU_HEIGHT = 120;
const CONTEXT_MENU_MARGIN = 8;

const clampContextMenuPosition = (x, y) => {
    if (typeof window === 'undefined') return { x, y };

    const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
    const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN);

    return {
        x: Math.max(CONTEXT_MENU_MARGIN, Math.min(x, maxX)),
        y: Math.max(CONTEXT_MENU_MARGIN, Math.min(y, maxY)),
    };
};

/* =========================================================
   TOOLTIP WRAPPER — shows a label to the right of the icon
   ========================================================= */
function SidebarTooltip({ label, children }) {
    const [visible, setVisible] = useState(false);

    return (
        <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ opacity: 0, x: -8, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -6, scale: 0.9 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            left: 'calc(100% + 14px)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(19, 13, 34, 0.96)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(168, 85, 247, 0.22)',
                            borderRadius: '10px',
                            padding: '7px 14px',
                            whiteSpace: 'nowrap',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#ede8ff',
                            zIndex: 9000,
                            pointerEvents: 'none',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 16px rgba(168,85,247,0.15)',
                        }}
                    >
                        {label}
                        {/* Arrow */}
                        <div style={{
                            position: 'absolute',
                            right: '100%',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 0, height: 0,
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                            borderRight: '6px solid rgba(168, 85, 247, 0.22)',
                        }} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* =========================================================
   SERVER ICON
   ========================================================= */
const ServerIcon = ({ icon, name, active, onClick, index, children, onContextMenu, isMobile, showLabel }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.6, x: -12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 320, damping: 22 }}
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '72px' : '52px',
                marginBottom: isMobile ? 0 : '6px',
                cursor: 'pointer',
                gap: isMobile ? '6px' : 0,
            }}
        >
            {/* Active pill indicator (desktop only) */}
            {!isMobile && (
                <motion.div
                    animate={{
                        height: active ? '38px' : '0px',
                        opacity: active ? 1 : 0,
                        scaleY: active ? 1 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    style={{
                        position: 'absolute',
                        left: '-16px',
                        width: '4px',
                        background: 'linear-gradient(180deg, #a855f7, #ec4899)',
                        borderRadius: '0 4px 4px 0',
                        boxShadow: '0 0 12px rgba(168,85,247,0.7)',
                    }}
                />
            )}

            <motion.div
                className="server-bubble"
                whileHover={{ borderRadius: '16px', scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                animate={{
                    borderRadius: active ? '16px' : '50%',
                    boxShadow: active
                        ? '0 0 0 2px rgba(168,85,247,0.8), 0 0 24px rgba(168,85,247,0.45)'
                        : '0 0 0 0px transparent, 0 0 0px transparent',
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                style={{
                    width: isMobile ? '56px' : '48px',
                    height: isMobile ? '56px' : '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    overflow: 'hidden',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: 700,
                    backgroundImage: children ? 'none' : `url(${icon || serverPlaceholder})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: children
                        ? (active ? 'rgba(168,85,247,0.4)' : 'rgba(19,13,34,0.9)')
                        : 'rgba(19,13,34,0.9)',
                    border: active ? '2px solid rgba(168,85,247,0.6)' : '2px solid rgba(168,85,247,0.12)',
                    transition: 'background-color 0.2s, border-color 0.2s',
                }}
            >
                {children ? children : (!icon && name?.substring(0, 2).toUpperCase())}
            </motion.div>

            {isMobile && showLabel && (
                <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: active ? '#c084fc' : 'var(--text-muted)',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '72px',
                }}>
                    {name?.length > 8 ? name.substring(0, 7) + '…' : name}
                </span>
            )}
        </motion.div>
    );
};

/* =========================================================
   MAIN SIDEBAR
   ========================================================= */
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

        const allIds = currentUser.joinedServers;
        const BATCH_SIZE = 30;
        const chunks = [];
        for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
            chunks.push(allIds.slice(i, i + BATCH_SIZE));
        }

        const unsubscribes = [];
        const chunkResults = new Map();

        chunks.forEach((chunk, chunkIndex) => {
            const q = query(collection(db, 'servers'), where(documentId(), 'in', chunk));
            const unsub = onSnapshot(q, (snapshot) => {
                const srvs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                chunkResults.set(chunkIndex, srvs);
                const all = [];
                for (const [, s] of chunkResults) all.push(...s);
                all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setServers(all);
            });
            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(u => u());
    }, [JSON.stringify(currentUser?.joinedServers)]);

    const handleContextMenu = (e, serverId) => {
        e.preventDefault();
        const { x, y } = clampContextMenuPosition(e.clientX, e.clientY);
        setContextMenu({ x, y, serverId });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        window.addEventListener('resize', handleClick);
        window.addEventListener('blur', handleClick);
        window.addEventListener('scroll', handleClick, true);

        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('resize', handleClick);
            window.removeEventListener('blur', handleClick);
            window.removeEventListener('scroll', handleClick, true);
        };
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
        const confirmed = await appConfirm(
            'Are you sure you want to leave this server?',
            { title: 'Leave Server', confirmText: 'Leave', cancelText: 'Cancel', danger: true }
        );
        if (!confirmed) return;
        try {
            const serverDoc = await getDoc(doc(db, 'servers', serverId));
            if (serverDoc.exists() && isServerOwner(currentUser, serverDoc.data())) {
                await appAlert('You cannot leave a server you own. Please delete it or transfer ownership first.', { title: 'Action Blocked' });
                return;
            }
            await deleteDoc(doc(db, 'servers', serverId, 'members', currentUser.uid));
            await updateDoc(doc(db, 'users', currentUser.uid), { joinedServers: arrayRemove(serverId) });
            setActiveServerId('home');
            setContextMenu(null);
        } catch (error) {
            if (import.meta.env.DEV) console.error('Error leaving server:', error);
            await appAlert('Failed to leave server.', { title: 'Leave Failed', danger: true });
        }
    };

    const contextMenuContent = typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.88, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: -4 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            background: 'rgba(13, 8, 26, 0.96)',
                            backdropFilter: 'blur(20px)',
                            padding: '8px',
                            borderRadius: '14px',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.18)',
                            border: '1px solid rgba(168,85,247,0.18)',
                            zIndex: 11000,
                            minWidth: '170px',
                        }}
                    >
                        <button
                            className="liquid-context-action"
                            onClick={() => { setSettingsServerId(contextMenu.serverId); setIsSettingsOpen(true); setContextMenu(null); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                width: '100%', padding: '10px 12px', textAlign: 'left',
                                background: 'transparent', border: 'none',
                                color: 'var(--text-primary)', cursor: 'pointer',
                                fontSize: '14px', fontWeight: 600, borderRadius: '8px',
                            }}
                        >
                            <Settings size={16} color="#a855f7" />
                            Server Settings
                        </button>
                        <button
                            className="liquid-context-action"
                            onClick={() => handleLeaveServer(contextMenu.serverId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                width: '100%', padding: '10px 12px', textAlign: 'left',
                                background: 'transparent', border: 'none',
                                color: 'var(--danger)', cursor: 'pointer',
                                fontSize: '14px', fontWeight: 600, borderRadius: '8px',
                            }}
                        >
                            <LogOut size={16} />
                            Leave Server
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        )
        : null;

    /* ——————— Mobile layout ——————— */
    if (isMobileView) {
        return (
            <div className="liquid-panel sidebar-mobile-shell" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Quick Actions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <motion.button
                        className="liquid-tile-button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsBrowserOpen(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '16px', backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)', borderRadius: '16px',
                            cursor: 'pointer', color: 'var(--text-primary)', gridColumn: '1 / -1',
                        }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Compass size={20} color="#818cf8" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Discover</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Find communities</div>
                        </div>
                    </motion.button>

                    {isSuperAdmin(currentUser) && (
                        <motion.button
                            className="liquid-tile-button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsSuperAdminOpen(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '16px', backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--glass-border)', borderRadius: '16px',
                                cursor: 'pointer', color: 'var(--text-primary)', gridColumn: '1 / -1',
                            }}
                        >
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '16px', backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--glass-border)', borderRadius: '16px',
                                cursor: 'pointer', color: 'var(--text-primary)', gridColumn: '1 / -1'
                            }}
                        >
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <GitBranch size={20} color="white" />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>Update Center</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Deploy new version</div>
                            </div>
                        </motion.button>
                    )}

                    <motion.button
                        className="liquid-tile-button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveServerId('home')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                            backgroundColor: activeServerId === 'home' ? 'rgba(168,85,247,0.12)' : 'var(--bg-secondary)',
                            border: activeServerId === 'home' ? '1px solid rgba(168,85,247,0.45)' : '1px solid var(--glass-border)',
                            borderRadius: '16px', cursor: 'pointer',
                            color: activeServerId === 'home' ? '#c084fc' : 'var(--text-primary)',
                        }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageCircle size={20} color="white" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Messages</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Direct chats</div>
                        </div>
                    </motion.button>

                    <motion.button
                        className="liquid-tile-button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCreateModalOpen(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)', borderRadius: '16px',
                            cursor: 'pointer', color: 'var(--text-primary)',
                        }}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={20} color="var(--success)" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Create</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>New server</div>
                        </div>
                    </motion.button>
                </div>

                {servers.length > 0 && (
                    <>
                        <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 0' }}>
                            Your Servers
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                            {servers.map((server, index) => (
                                <motion.button
                                    className="liquid-tile-button"
                                    key={server.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setActiveServerId(server.id)}
                                    onContextMenu={(e) => handleContextMenu(e, server.id)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        gap: '10px', padding: '16px 12px',
                                        backgroundColor: activeServerId === server.id ? 'rgba(168,85,247,0.12)' : 'var(--bg-secondary)',
                                        border: activeServerId === server.id ? '1px solid rgba(168,85,247,0.45)' : '1px solid var(--glass-border)',
                                        borderRadius: '16px', cursor: 'pointer', color: 'var(--text-primary)', position: 'relative',
                                    }}
                                >
                                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', backgroundImage: server.icon ? `url(${server.icon})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {!server.icon && server.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', color: activeServerId === server.id ? '#c084fc' : 'var(--text-primary)' }}>
                                        {server.name}
                                    </span>
                                    {activeServerId === server.id && (
                                        <motion.div
                                            layoutId="activeServerMobile"
                                            style={{ position: 'absolute', bottom: '-1px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '3px', background: 'var(--gradient-primary)', borderRadius: '3px 3px 0 0' }}
                                        />
                                    )}
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setSettingsServerId(server.id); setIsSettingsOpen(true); }}
                                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                                    >
                                        <Settings size={14} />
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </>
                )}

                {servers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Settings size={28} color="#a855f7" />
                        </div>
                        <p>No servers yet</p>
                        <p style={{ fontSize: '13px' }}>Create one to get started!</p>
                    </div>
                )}

                <CreateServerModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
                <ServerSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} serverId={settingsServerId} />
                <ServerBrowser isOpen={isBrowserOpen} onClose={() => setIsBrowserOpen(false)} onJoinServer={(id) => setActiveServerId(id)} isMobile={isMobileView} />
                <SuperAdminModal isOpen={isSuperAdminOpen} onClose={() => setIsSuperAdminOpen(false)} isMobile={true} />
                <UpdateCenterModal isOpen={isUpdateCenterOpen} onClose={() => setIsUpdateCenterOpen(false)} />
                {contextMenuContent}
            </div>
        );
    }

    /* ——————— Desktop sidebar ——————— */
    return (
        <div
            className="liquid-panel sidebar-shell"
            style={{
                width: '72px',
                height: 'var(--app-vh)',
                background: 'linear-gradient(180deg, rgba(10, 6, 20, 0.98) 0%, rgba(13, 8, 26, 0.98) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 0',
                gap: '0',
                borderRight: '1px solid rgba(168,85,247,0.1)',
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
            }}
        >
            {/* Home / DMs */}
            <SidebarTooltip label="Direct Messages">
                <ServerIcon
                    name="Direct Messages"
                    active={activeServerId === 'home'}
                    onClick={() => setActiveServerId('home')}
                    index={0}
                >
                    <MessageCircle size={22} />
                </ServerIcon>
            </SidebarTooltip>

            {/* Divider */}
            <motion.div
                style={{ width: '34px', height: '2px', margin: '6px 0 8px', borderRadius: '2px', background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.35), transparent)' }}
            />

            {/* Server list */}
            <AnimatePresence>
                {servers.map((server, index) => (
                    <SidebarTooltip key={server.id} label={server.name || 'Server'}>
                        <ServerIcon
                            icon={server.icon}
                            name={server.name}
                            active={activeServerId === server.id}
                            onClick={() => setActiveServerId(server.id)}
                            onContextMenu={(e) => handleContextMenu(e, server.id)}
                            index={index + 1}
                        />
                    </SidebarTooltip>
                ))}
            </AnimatePresence>

            {/* Add server */}
            <SidebarTooltip label="Add a Server">
                <ServerIcon name="Add a Server" active={false} onClick={() => setIsCreateModalOpen(true)} index={servers.length + 1}>
                    <Plus size={22} color="#10b981" />
                </ServerIcon>
            </SidebarTooltip>

            {/* Discover */}
            <SidebarTooltip label="Discover Servers">
                <ServerIcon name="Discover Servers" active={false} onClick={() => setIsBrowserOpen(true)} index={servers.length + 2}>
                    <Compass size={22} color="#b0a0cc" />
                </ServerIcon>
            </SidebarTooltip>

            {/* Super Admin */}
            {isSuperAdmin(currentUser) && (
                <SidebarTooltip label="Super Admin">
                    <ServerIcon name="Super Admin" active={false} onClick={() => setIsSuperAdminOpen(true)} index={servers.length + 3}>
                        <div style={{ width: '100%', height: '100%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Settings size={22} color="white" />
                        </div>
                    </ServerIcon>
                </SidebarTooltip>
            )}

            {isUpdateCenterUser(currentUser, updateCenterEmails) && (
                <SidebarTooltip label="Update Center">
                    <ServerIcon name="Update Center" active={false} onClick={() => setIsUpdateCenterOpen(true)} index={servers.length + 4}>
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GitBranch size={22} color="white" />
                        </div>
                    </ServerIcon>
                </SidebarTooltip>
            )}

            <CreateServerModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            <ServerSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} serverId={settingsServerId} />
            <ServerBrowser isOpen={isBrowserOpen} onClose={() => setIsBrowserOpen(false)} onJoinServer={(id) => setActiveServerId(id)} isMobile={false} />
            <SuperAdminModal isOpen={isSuperAdminOpen} onClose={() => setIsSuperAdminOpen(false)} />
            <UpdateCenterModal isOpen={isUpdateCenterOpen} onClose={() => setIsUpdateCenterOpen(false)} />

            {contextMenuContent}
        </div>
    );
}
