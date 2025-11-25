import { motion } from 'framer-motion';
import { Compass, MessageSquare, Users, User } from 'lucide-react';

const tabs = [
    { id: 'servers', label: 'Explore', icon: Compass },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'profile', label: 'You', icon: User }
];

export default function MobileNavBar({ activeTab, setActiveTab }) {
    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-start',
            paddingTop: '6px',
            zIndex: 100,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
        }}>
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <motion.button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px 0',
                            position: 'relative'
                        }}
                    >
                        {/* Active indicator */}
                        {isActive && (
                            <motion.div
                                layoutId="activeTab"
                                style={{
                                    position: 'absolute',
                                    top: '-6px',
                                    width: '24px',
                                    height: '3px',
                                    backgroundColor: 'var(--accent)',
                                    borderRadius: '0 0 4px 4px'
                                }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        )}

                        {/* Icon container */}
                        <motion.div
                            animate={{
                                scale: isActive ? 1.1 : 1,
                                y: isActive ? -2 : 0
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            style={{
                                width: '40px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '12px',
                                backgroundColor: isActive ? 'var(--accent-dim)' : 'transparent'
                            }}
                        >
                            <Icon
                                size={22}
                                color={isActive ? 'var(--accent)' : 'var(--text-muted)'}
                                strokeWidth={isActive ? 2.5 : 2}
                            />
                        </motion.div>

                        {/* Label */}
                        <span style={{
                            fontSize: '10px',
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                            letterSpacing: '0.2px'
                        }}>
                            {tab.label}
                        </span>
                    </motion.button>
                );
            })}
        </div>
    );
}
