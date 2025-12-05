import { motion } from 'framer-motion';
import { BADGES, getUserBadges, getBadgeStyle } from '../utils/badges';

export default function UserBadges({ user, maxBadges = 3, showAll = false }) {
    const badges = getUserBadges(user);

    if (badges.length === 0) return null;

    const displayBadges = showAll ? badges : badges.slice(0, maxBadges);
    const remainingCount = badges.length - displayBadges.length;

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            marginLeft: '4px'
        }}>
            {displayBadges.map((badge, index) => (
                <motion.span
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    style={getBadgeStyle(badge)}
                    title={`${badge.name}: ${badge.description}`}
                >
                    {badge.emoji}
                </motion.span>
            ))}

            {remainingCount > 0 && (
                <span style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginLeft: '2px'
                }}>
                    +{remainingCount}
                </span>
            )}
        </div>
    );
}

// Expanded badge list for profile views
export function UserBadgesList({ user }) {
    const badges = getUserBadges(user);

    if (badges.length === 0) {
        return (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No badges yet
            </p>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
        }}>
            {badges.map((badge) => (
                <motion.div
                    key={badge.id}
                    whileHover={{ scale: 1.05 }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: `${badge.color}15`,
                        border: `1px solid ${badge.color}30`,
                        borderRadius: '8px',
                        cursor: 'default'
                    }}
                    title={badge.description}
                >
                    <span style={{ fontSize: '16px' }}>{badge.emoji}</span>
                    <div>
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: badge.color
                        }}>
                            {badge.name}
                        </div>
                        <div style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)'
                        }}>
                            {badge.description}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
