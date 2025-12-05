import { motion } from 'framer-motion';

export default function TypingIndicator({ typingUsers }) {
    if (!typingUsers || typingUsers.length === 0) return null;

    const getTypingText = () => {
        if (typingUsers.length === 1) {
            return `${typingUsers[0]} is typing`;
        } else if (typingUsers.length === 2) {
            return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
        } else if (typingUsers.length === 3) {
            return `${typingUsers[0]}, ${typingUsers[1]}, and ${typingUsers[2]} are typing`;
        } else {
            return `${typingUsers.length} people are typing`;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 16px',
                fontSize: '13px',
                color: 'var(--text-muted)'
            }}
        >
            {/* Animated dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        animate={{
                            y: [0, -4, 0],
                            opacity: [0.4, 1, 0.4]
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15
                        }}
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--text-muted)'
                        }}
                    />
                ))}
            </div>

            <span>
                <strong style={{ color: 'var(--text-secondary)' }}>
                    {getTypingText()}
                </strong>
                ...
            </span>
        </motion.div>
    );
}
