import { useState, useEffect } from 'react';
import { Plus, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import CreateServerModal from './CreateServerModal';
import ServerSettingsModal from './ServerSettingsModal';

import serverPlaceholder from '../assets/server_placeholder.png';

const ServerIcon = ({ icon, name, active, onClick, index, children, onContextMenu }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                delay: index * 0.1,
                type: "spring",
                stiffness: 260,
                damping: 20
            }}
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                marginBottom: '8px',
                cursor: 'pointer',
                group: 'server-icon'
            }}
        >
            {/* Active Indicator */}
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

            <motion.div
                whileHover={{ borderRadius: '16px', scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                    borderRadius: active ? '16px' : '50%',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    overflow: 'hidden',
                    transition: 'background-color 0.2s',
                    fontSize: '14px',
                    fontWeight: 700,
                    backgroundImage: children ? 'none' : `url(${icon || serverPlaceholder})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: children ? (active ? 'var(--accent)' : 'var(--bg-tertiary)') : 'transparent'
                }}
            >
                {children ? children : (!icon && name?.substring(0, 2).toUpperCase())}
            </motion.div>
        </motion.div>
    );
};

export default function Sidebar({ activeServerId, setActiveServerId }) {
    const [servers, setServers] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, serverId }
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsServerId, setSettingsServerId] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "servers"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const srvs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setServers(srvs);
        });
        return unsubscribe;
    }, []);

    const handleContextMenu = (e, serverId) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, serverId });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

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
            borderRight: '1px solid var(--glass-border)'
        }}>
            {/* Home Icon */}
            <ServerIcon
                id="home"
                name="Direct Messages"
                active={activeServerId === 'home'}
                onClick={() => setActiveServerId('home')}
                index={0}
            >
                <img src="https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Home" style={{ width: '28px', height: '28px' }} />
            </ServerIcon>

            <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--glass-border)', margin: '4px 0' }} />

            {/* Server List */}
            <AnimatePresence>
                {servers.map((server, index) => (
                    <ServerIcon
                        key={server.id}
                        id={server.id}
                        name={server.name}
                        active={activeServerId === server.id}
                        onClick={() => setActiveServerId(server.id)}
                        onContextMenu={(e) => handleContextMenu(e, server.id)}
                        index={index + 1}
                    />
                ))}
            </AnimatePresence>

            <ServerIcon
                id="add-server"
                name="Add a Server"
                active={false}
                onClick={() => setIsCreateModalOpen(true)}
                index={servers.length + 1}
            >
                <Plus size={24} color="#23a559" />
            </ServerIcon>

            <CreateServerModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            <ServerSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                serverId={settingsServerId}
            />

            {/* Context Menu */}
            {contextMenu && (
                <div style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '8px',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 2000
                }}>
                    <button
                        onClick={() => {
                            setSettingsServerId(contextMenu.serverId);
                            setIsSettingsOpen(true);
                            setContextMenu(null);
                        }}
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '8px 12px',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                        className="hover:bg-white/10"
                    >
                        Server Settings
                    </button>
                </div>
            )}
        </div>
    );
}
