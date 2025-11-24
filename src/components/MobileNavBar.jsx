import { Home, MessageSquare, Users, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MobileNavBar({ activeTab, setActiveTab }) {
    const tabs = [
        { id: 'servers', icon: Home, label: 'Servers' },
        { id: 'chat', icon: MessageSquare, label: 'Chat' },
        { id: 'friends', icon: Users, label: 'Friends' },
        { id: 'profile', icon: User, label: 'You' }
    ];

    return (
        <div style={{
            height: 'calc(60px + var(--safe-area-bottom, 0px))',
            paddingBottom: 'var(--safe-area-bottom, 0px)',
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            zIndex: 1000
        }}>
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                            padding: '8px',
                            flex: 1
                        }}
                    >
                        <motion.div
                            animate={{ scale: isActive ? 1.2 : 1 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        </motion.div>
                        <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
