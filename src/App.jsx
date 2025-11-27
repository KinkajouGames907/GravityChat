import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import ChannelList from './components/ChannelList';
import ChatArea from './components/ChatArea';
import FriendList from './components/FriendList';
import { AnimatePresence, motion } from 'framer-motion';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import CallModal from './components/CallModal';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

import MobileLayout from './components/MobileLayout';

function Home() {
  const [activeServerId, setActiveServerId] = useState('home');
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeChannelName, setActiveChannelName] = useState('general');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // { id, isCaller: false }
  const [activeDmUser, setActiveDmUser] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setShowMobileMenu(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!currentUser) return;

    // Query for calls where receiver.uid is current user and status is 'offering'
    // Note: In a real app, we might need a composite index or a better structure.
    // For now, let's just listen to "calls" and filter client side if needed, or use a simple query.
    // Ideally: where("receiver.uid", "==", currentUser.uid), where("status", "==", "offering")

    // Since we don't have the index yet, let's try to just listen to recent calls and filter.
    // Or better, let's just rely on the fact that we can query by receiver.uid if we index it.
    // Let's assume we can query.

    const q = query(
      collection(db, "calls"),
      where("receiver.uid", "==", currentUser.uid),
      where("status", "==", "offering")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          setIncomingCall({ id: change.doc.id, isCaller: false });
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (isMobile) {
    return <MobileLayout />;
  }

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
        VERY EARLY ALPHA BUILD V0.0.2
      </div>

      {/* Navigation (Sidebar + ChannelList) */}
      <div style={{ display: 'flex', position: 'relative', zIndex: 100, height: '100%' }}>
        <Sidebar
          activeServerId={activeServerId}
          setActiveServerId={setActiveServerId}
        />
        <ChannelList
          activeServerId={activeServerId}
          activeChannelId={activeChannelId}
          setActiveChannelId={setActiveChannelId}
          setActiveChannelName={setActiveChannelName}
          setActiveDmUser={setActiveDmUser}
        />
      </div>

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
                  setActiveDmUser(user);
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
                activeDmUser={activeDmUser}
                isMobile={false}
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
