import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import ChannelList from './components/ChannelList';
import ChatArea from './components/ChatArea';
import FriendList from './components/FriendList';
import { AnimatePresence, motion } from 'framer-motion';

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
  const { currentUser } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setShowMobileMenu(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Global Liquid Background */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(45deg, #0f0c29, #302b63, #24243e)',
          backgroundSize: '400% 400%',
          zIndex: -1,
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 15,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* Beta Label */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        color: 'rgba(255, 255, 255, 0.2)',
        fontSize: '10px',
        fontWeight: 'bold',
        pointerEvents: 'none',
        zIndex: 1000,
        fontFamily: 'monospace'
      }}>
        VERY EARLY BETA BUILD V0.0.1
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobile && showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileMenu(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 99,
              backdropFilter: 'blur(2px)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Navigation (Sidebar + ChannelList) */}
      <motion.div
        initial={false}
        animate={isMobile ? { x: showMobileMenu ? 0 : '-100%' } : { x: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          display: 'flex',
          position: isMobile ? 'fixed' : 'relative',
          zIndex: 100,
          height: '100%',
          boxShadow: isMobile ? '5px 0 15px rgba(0,0,0,0.5)' : 'none'
        }}
      >
        <Sidebar
          activeServerId={activeServerId}
          setActiveServerId={setActiveServerId}
        />
        <ChannelList
          activeServerId={activeServerId}
          activeChannelId={activeChannelId}
          setActiveChannelId={(id) => {
            setActiveChannelId(id);
            if (isMobile) setShowMobileMenu(false);
          }}
          setActiveChannelName={setActiveChannelName}
        />
      </motion.div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {activeChannelId === 'friends' ? (
            <motion.div
              key="friends"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', height: '100%' }}
            >
              <FriendList
                onStartDM={(user) => {
                  const sortedIds = [currentUser.uid, user.uid].sort();
                  const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                  setActiveChannelId(dmId);
                  setActiveChannelName(user.displayName);
                  if (isMobile) setShowMobileMenu(false);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ChatArea
                activeChannelId={activeChannelId}
                activeChannelName={activeChannelName}
                activeServerId={activeServerId}
                isMobile={isMobile}
                onOpenMenu={() => setShowMobileMenu(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
