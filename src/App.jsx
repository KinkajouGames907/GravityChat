import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import ChannelList from './components/ChannelList';
import ChatArea from './components/ChatArea';
import FriendList from './components/FriendList';
import MobileLayout from './components/MobileLayout';
import CallModal from './components/CallModal';
import ErrorBoundary from './components/ErrorBoundary';
import ParticleEffects from './components/ParticleEffects';
import AppLoader from './components/AppLoader';
import QuickSwitcher from './components/QuickSwitcher';
import { AnimatePresence, motion } from 'framer-motion';
import { PeerProvider, usePeer } from './context/PeerContext';
import { SoundProvider, useSound } from './context/SoundContext';
import { EmojiProvider } from './context/EmojiContext';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

function PrivateRoute({ children }) {
    const { currentUser } = useAuth();
    return currentUser ? children : <Navigate to="/login" />;
}

function Home() {
    const [activeServerId, setActiveServerId] = useState('home');
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [activeChannelName, setActiveChannelName] = useState('general');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [activeDmUser, setActiveDmUser] = useState(null);
    const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
    const { currentUser } = useAuth();
    const { incomingCall, setIncomingCall, activeCall } = usePeer();
    const [ongoingCall, setOngoingCall] = useState(null);

    const { createRingtone, isMuted } = useSound();
    const ringtoneRef = useRef(null);

    useEffect(() => {
        ringtoneRef.current = createRingtone();
        ringtoneRef.current.loop = true;
    }, []);

    useEffect(() => {
        if (ringtoneRef.current) {
            ringtoneRef.current.volume = isMuted ? 0 : 1;
        }
    }, [isMuted]);

    useEffect(() => {
        if (incomingCall && !isMuted) {
            ringtoneRef.current.play().catch(() => {});
        } else {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
    }, [incomingCall, isMuted]);

    useEffect(() => {
        if (incomingCall) {
            if (!ongoingCall) setOngoingCall(incomingCall);
        } else if (!activeCall) {
            setOngoingCall(null);
        }
    }, [incomingCall, activeCall]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) setShowMobileMenu(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Ctrl+K / Cmd+K — Quick Switcher
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowQuickSwitcher(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleQuickNavigate = ({ serverId, channelId, channelName, dmUser }) => {
        if (serverId !== activeServerId) setActiveServerId(serverId);
        setActiveChannelId(channelId);
        setActiveChannelName(channelName);
        setActiveDmUser(dmUser || null);
    };

    return (
        <div className="app-liquid-shell" style={{
            display: 'flex',
            width: '100vw',
            height: 'var(--app-vh)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {isMobile ? (
                <MobileLayout />
            ) : (
                <>
                    {/* Nebula animated background */}
                    <motion.div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(135deg, #06040f 0%, #0e0a1a 40%, #130d22 70%, #0a0418 100%)',
                            backgroundSize: '280% 280%',
                            zIndex: -1,
                        }}
                        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                        transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
                    />

                    {/* Version badge */}
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        color: 'rgba(168,85,247,0.25)',
                        fontSize: '10px',
                        fontWeight: 700,
                        pointerEvents: 'none',
                        zIndex: 1000,
                        fontFamily: 'monospace',
                        letterSpacing: '0.06em',
                    }}>
                        VERY EARLY ALPHA V0.0.3
                    </div>

                    {/* Navigation */}
                    <div className="app-nav-shell" style={{ display: 'flex', position: 'relative', zIndex: 100, height: '100%' }}>
                        <Sidebar activeServerId={activeServerId} setActiveServerId={setActiveServerId} />
                        <ChannelList
                            activeServerId={activeServerId}
                            activeChannelId={activeChannelId}
                            setActiveChannelId={setActiveChannelId}
                            setActiveChannelName={setActiveChannelName}
                            setActiveDmUser={setActiveDmUser}
                        />
                    </div>

                    {/* Main content */}
                    <div className="app-content-shell" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <AnimatePresence mode="wait">
                            {activeChannelId === 'friends' ? (
                                <motion.div
                                    key="friends"
                                    initial={{ opacity: 0, x: 24 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -24 }}
                                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ width: '100%', height: '100%' }}
                                >
                                    <FriendList
                                        onStartDM={(user) => {
                                            const sortedIds = [currentUser.uid, user.uid].sort();
                                            const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                                            setActiveChannelId(dmId);
                                            setActiveChannelName(user.displayName);
                                            setActiveDmUser(user);
                                        }}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={activeChannelId || 'empty'}
                                    initial={{ opacity: 0, x: 24 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -24 }}
                                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ width: '100%', height: '100%' }}
                                >
                                    <ChatArea
                                        activeChannelId={activeChannelId}
                                        activeChannelName={activeChannelName}
                                        activeServerId={activeServerId}
                                        activeDmUser={activeDmUser}
                                        isMobile={false}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </>
            )}

            {ongoingCall && (
                <CallModal
                    call={ongoingCall}
                    currentUser={currentUser}
                    isCaller={false}
                    onClose={() => setIncomingCall(null)}
                />
            )}

            <AnimatePresence>
                {showQuickSwitcher && (
                    <QuickSwitcher
                        isOpen={showQuickSwitcher}
                        onClose={() => setShowQuickSwitcher(false)}
                        onNavigate={handleQuickNavigate}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function App() {
    const [appReady, setAppReady] = useState(false);

    useEffect(() => {
        const updateAppViewportHeight = () => {
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            document.documentElement.style.setProperty('--app-vh', `${Math.round(viewportHeight)}px`);
        };

        updateAppViewportHeight();

        const visualViewport = window.visualViewport;
        window.addEventListener('resize', updateAppViewportHeight);
        window.addEventListener('orientationchange', updateAppViewportHeight);
        visualViewport?.addEventListener('resize', updateAppViewportHeight);
        visualViewport?.addEventListener('scroll', updateAppViewportHeight);

        // Show splash for 1.8s then fade
        const timer = setTimeout(() => setAppReady(true), 1800);

        return () => {
            window.removeEventListener('resize', updateAppViewportHeight);
            window.removeEventListener('orientationchange', updateAppViewportHeight);
            visualViewport?.removeEventListener('resize', updateAppViewportHeight);
            visualViewport?.removeEventListener('scroll', updateAppViewportHeight);
            clearTimeout(timer);
        };
    }, []);

    return (
        <ErrorBoundary>
            <AuthProvider>
                <ThemeProvider>
                    <SoundProvider>
                        <EmojiProvider>
                            <PeerProvider>
                                <AppLoader show={!appReady} />
                                <Router>
                                    <ParticleEffects />
                                    <Routes>
                                        <Route path="/login" element={<Login />} />
                                        <Route path="/" element={
                                            <PrivateRoute>
                                                <Home />
                                            </PrivateRoute>
                                        } />
                                    </Routes>
                                </Router>
                            </PeerProvider>
                        </EmojiProvider>
                    </SoundProvider>
                </ThemeProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
