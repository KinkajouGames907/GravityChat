import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, LogOut, ChevronRight, Moon, Bell, Shield, HelpCircle } from 'lucide-react';
import MobileNavBar from './MobileNavBar';
import Sidebar from './Sidebar';
import ChannelList from './ChannelList';
import ChatArea from './ChatArea';
import FriendList from './FriendList';
import SettingsModal from './SettingsModal';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function MobileLayout() {
    const [activeTab, setActiveTab] = useState('chat');
    const [activeServerId, setActiveServerId] = useState('home');
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [activeChannelName, setActiveChannelName] = useState('general');
    const [showSettings, setShowSettings] = useState(false);
    const [settingsInitialTab, setSettingsInitialTab] = useState('account');
    const [activeDmUser, setActiveDmUser] = useState(null);
    const { currentUser } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Tab Content Rendering
    const renderContent = () => {
        switch (activeTab) {
            case 'servers':
                return (
                    <div style={{
                        height: '100%',
                        overflowY: 'auto',
                        padding: '16px',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        <h2 style={{
                            marginBottom: '20px',
                            fontSize: '22px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Your Servers
                        </h2>
                        <Sidebar
                            activeServerId={activeServerId}
                            setActiveServerId={(id) => {
                                setActiveServerId(id);
                                setActiveChannelId(null);
                                setActiveTab('chat');
                            }}
                            isMobileView={true}
                        />
                    </div>
                );

            case 'chat':
                if (!activeChannelId && activeServerId === 'home') {
                    return (
                        <div style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                boxShadow: '0 8px 32px rgba(29, 155, 240, 0.3)'
                            }}>
                                <span style={{ fontSize: '36px' }}>💬</span>
                            </div>
                            <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: 700 }}>
                                Welcome to Gravity
                            </h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '280px' }}>
                                Select a server or friend to start chatting with your community
                            </p>
                            <button
                                className="glossy-button"
                                onClick={() => setActiveTab('servers')}
                                style={{ padding: '14px 28px' }}
                            >
                                Browse Servers
                            </button>
                        </div>
                    );
                }

                return (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {activeServerId !== 'home' && !activeChannelId && (
                            <div style={{
                                height: '100%',
                                overflowY: 'auto',
                                WebkitOverflowScrolling: 'touch'
                            }}>
                                <ChannelList
                                    activeServerId={activeServerId}
                                    activeChannelId={activeChannelId}
                                    setActiveChannelId={setActiveChannelId}
                                    setActiveChannelName={setActiveChannelName}
                                    isMobileView={true}
                                    setActiveDmUser={setActiveDmUser}
                                />
                            </div>
                        )}
                        {activeChannelId && (
                            <ChatArea
                                activeChannelId={activeChannelId}
                                activeChannelName={activeChannelName}
                                activeServerId={activeServerId}
                                isMobile={true}
                                onOpenMenu={() => setActiveChannelId(null)}
                                activeDmUser={activeDmUser}
                            />
                        )}
                    </div>
                );

            case 'friends':
                return (
                    <div style={{
                        height: '100%',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        <FriendList
                            onStartDM={(user) => {
                                const sortedIds = [currentUser.uid, user.uid].sort();
                                const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                                setActiveChannelId(dmId);
                                setActiveChannelName(user.displayName);
                                setActiveDmUser(user);
                                setActiveServerId('home');
                                setActiveTab('chat');
                            }}
                        />
                    </div>
                );

            case 'profile':
                return (
                    <div style={{
                        height: '100%',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        padding: '20px'
                    }}>
                        {/* Profile Header */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '40px 20px',
                            background: 'linear-gradient(180deg, rgba(29, 155, 240, 0.1), transparent)',
                            borderRadius: '20px',
                            marginBottom: '24px'
                        }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                backgroundImage: `url(${currentUser.photoURL})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: '4px solid var(--accent)',
                                boxShadow: '0 8px 32px rgba(29, 155, 240, 0.3)',
                                marginBottom: '16px'
                            }} />
                            <h2 style={{
                                fontSize: '22px',
                                fontWeight: 700,
                                marginBottom: '4px'
                            }}>
                                {currentUser.displayName}
                            </h2>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--text-muted)'
                            }}>
                                {currentUser.email}
                            </p>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '12px',
                                padding: '6px 12px',
                                backgroundColor: 'rgba(0, 186, 124, 0.1)',
                                borderRadius: '20px'
                            }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--success)'
                                }} />
                                <span style={{ fontSize: '13px', color: 'var(--success)' }}>Online</span>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            marginBottom: '16px'
                        }}>
                            <button
                                onClick={() => {
                                    setSettingsInitialTab('account');
                                    setShowSettings(true);
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}
                            >
                                <Settings size={22} color="var(--accent)" style={{ marginRight: '16px' }} />
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Settings</span>
                                <ChevronRight size={20} color="var(--text-muted)" />
                            </button>

                            <button
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}
                            >
                                <Bell size={22} color="var(--text-secondary)" style={{ marginRight: '16px' }} />
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Notifications</span>
                                <ChevronRight size={20} color="var(--text-muted)" />
                            </button>

                            <button
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}
                            >
                                <Moon size={22} color="var(--text-secondary)" style={{ marginRight: '16px' }} />
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Appearance</span>
                                <ChevronRight size={20} color="var(--text-muted)" />
                            </button>

                            <button
                                onClick={() => {
                                    setSettingsInitialTab('privacy');
                                    setShowSettings(true);
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--glass-border)'
                                }}
                            >
                                <Shield size={22} color="var(--text-secondary)" style={{ marginRight: '16px' }} />
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Privacy & Safety</span>
                                <ChevronRight size={20} color="var(--text-muted)" />
                            </button>

                            <button
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <HelpCircle size={22} color="var(--text-secondary)" style={{ marginRight: '16px' }} />
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Help & Support</span>
                                <ChevronRight size={20} color="var(--text-muted)" />
                            </button>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '16px 20px',
                                backgroundColor: 'rgba(244, 33, 46, 0.1)',
                                border: '1px solid rgba(244, 33, 46, 0.2)',
                                borderRadius: '16px',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                gap: '10px',
                                fontWeight: 600
                            }}
                        >
                            <LogOut size={20} />
                            Log Out
                        </button>

                        {/* App Version */}
                        <div style={{
                            textAlign: 'center',
                            marginTop: '24px',
                            color: 'var(--text-muted)',
                            fontSize: '12px'
                        }}>
                            Gravity Alpha 0.0.3
                        </div>
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
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Main Content Area */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                paddingBottom: activeTab !== 'chat' || !activeChannelId
                    ? 'calc(60px + env(safe-area-inset-bottom, 0px))'
                    : 0
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab + activeChannelId}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{ height: '100%' }}
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Navigation - Hide when in active chat */}
            {(activeTab !== 'chat' || !activeChannelId) && (
                <MobileNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
            )}

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => {
                    setShowSettings(false);
                    // Reset initial tab when closing
                    setSettingsInitialTab('account');
                }}
                initialTab={settingsInitialTab}
            />
        </div>
    );
}
