import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileNavBar from './MobileNavBar';
import Sidebar from './Sidebar'; // Reusing for now, will optimize later
import ChannelList from './ChannelList'; // Reusing
import ChatArea from './ChatArea';
import FriendList from './FriendList';
import SettingsModal from './SettingsModal';
import { useAuth } from '../context/AuthContext';

export default function MobileLayout() {
    const [activeTab, setActiveTab] = useState('chat');
    const [activeServerId, setActiveServerId] = useState('home');
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [activeChannelName, setActiveChannelName] = useState('general');
    const [showSettings, setShowSettings] = useState(false);
    const { currentUser } = useAuth();

    // Tab Content Rendering
    const renderContent = () => {
        switch (activeTab) {
            case 'servers':
                return (
                    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
                        <h2 style={{ marginBottom: '16px' }}>Servers</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <Sidebar
                                activeServerId={activeServerId}
                                setActiveServerId={(id) => {
                                    setActiveServerId(id);
                                    setActiveTab('chat'); // Switch to chat after selection
                                }}
                                isMobileView={true} // Pass prop to style differently if needed
                            />
                        </div>
                    </div>
                );
            case 'chat':
                if (!activeChannelId && activeServerId === 'home') {
                    // Default view if no chat selected
                    return (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '40%' }}>
                            <p>Select a server or friend to start chatting.</p>
                            <button
                                className="glossy-button"
                                onClick={() => setActiveTab('servers')}
                                style={{ marginTop: '20px' }}
                            >
                                Browse Servers
                            </button>
                        </div>
                    )
                }
                return (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* We might need a way to select channels if a server is active */}
                        {activeServerId !== 'home' && !activeChannelId && (
                            <ChannelList
                                activeServerId={activeServerId}
                                activeChannelId={activeChannelId}
                                setActiveChannelId={setActiveChannelId}
                                setActiveChannelName={setActiveChannelName}
                                isMobileView={true}
                            />
                        )}
                        {activeChannelId && (
                            <ChatArea
                                activeChannelId={activeChannelId}
                                activeChannelName={activeChannelName}
                                activeServerId={activeServerId}
                                isMobile={true}
                                onOpenMenu={() => setActiveChannelId(null)} // Back to channel list
                            />
                        )}
                    </div>
                );
            case 'friends':
                return (
                    <FriendList
                        onStartDM={(user) => {
                            const sortedIds = [currentUser.uid, user.uid].sort();
                            const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                            setActiveChannelId(dmId);
                            setActiveChannelName(user.displayName);
                            setActiveServerId('home');
                            setActiveTab('chat');
                        }}
                    />
                );
            case 'profile':
                return (
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '40px' }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            backgroundImage: `url(${currentUser.photoURL})`,
                            backgroundSize: 'cover',
                            border: '2px solid var(--accent)'
                        }} />
                        <h2>{currentUser.displayName}</h2>
                        <button className="glossy-button" onClick={() => setShowSettings(true)}>
                            Settings
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{
            width: '100vw',
            height: '100dvh',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Main Content Area */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                paddingBottom: 'calc(60px + var(--safe-area-bottom, 0px))' // Space for nav bar
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        style={{ height: '100%' }}
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Navigation */}
            <MobileNavBar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            </AnimatePresence>
        </div>
    );
}
