// User Badges System
// Badges are displayed next to usernames to show achievements, roles, and special status

export const BADGES = {
    // Staff Badges
    DEVELOPER: {
        id: 'developer',
        name: 'Developer',
        description: 'Gravity-CHAT Developer',
        emoji: '🛠️',
        color: '#f97316',
        icon: 'Code'
    },
    ADMIN: {
        id: 'admin',
        name: 'Admin',
        description: 'Platform Administrator',
        emoji: '⚡',
        color: '#ef4444',
        icon: 'Shield'
    },
    MODERATOR: {
        id: 'moderator',
        name: 'Moderator',
        description: 'Community Moderator',
        emoji: '🛡️',
        color: '#22c55e',
        icon: 'ShieldCheck'
    },

    // User Achievement Badges
    EARLY_SUPPORTER: {
        id: 'early_supporter',
        name: 'Early Supporter',
        description: 'Joined during alpha/beta',
        emoji: '🌟',
        color: '#eab308',
        icon: 'Star'
    },
    PREMIUM: {
        id: 'premium',
        name: 'Premium',
        description: 'Premium subscriber',
        emoji: '💎',
        color: '#a855f7',
        icon: 'Gem'
    },
    VERIFIED: {
        id: 'verified',
        name: 'Verified',
        description: 'Verified user',
        emoji: '✓',
        color: '#3b82f6',
        icon: 'BadgeCheck'
    },
    BOT: {
        id: 'bot',
        name: 'Bot',
        description: 'Automated bot account',
        emoji: '🤖',
        color: '#6366f1',
        icon: 'Bot'
    },

    // Activity Badges
    BUG_HUNTER: {
        id: 'bug_hunter',
        name: 'Bug Hunter',
        description: 'Found and reported bugs',
        emoji: '🐛',
        color: '#10b981',
        icon: 'Bug'
    },
    ACTIVE_CONTRIBUTOR: {
        id: 'active_contributor',
        name: 'Active Contributor',
        description: 'Active community member',
        emoji: '💬',
        color: '#06b6d4',
        icon: 'MessageCircle'
    },
    SERVER_BOOSTER: {
        id: 'server_booster',
        name: 'Server Booster',
        description: 'Currently boosting a server',
        emoji: '🚀',
        color: '#ec4899',
        icon: 'Rocket'
    },

    // Milestone Badges
    MESSAGES_100: {
        id: 'messages_100',
        name: '100 Messages',
        description: 'Sent 100 messages',
        emoji: '💯',
        color: '#f59e0b',
        icon: 'Hash'
    },
    MESSAGES_1000: {
        id: 'messages_1000',
        name: '1K Messages',
        description: 'Sent 1,000 messages',
        emoji: '🎯',
        color: '#f59e0b',
        icon: 'Target'
    },
    MESSAGES_10000: {
        id: 'messages_10000',
        name: '10K Messages',
        description: 'Sent 10,000 messages',
        emoji: '🔥',
        color: '#f59e0b',
        icon: 'Flame'
    },

    // Special Event Badges
    HALLOWEEN_2024: {
        id: 'halloween_2024',
        name: 'Spooky 2024',
        description: 'Active during Halloween 2024',
        emoji: '🎃',
        color: '#f97316',
        icon: 'Ghost'
    },
    WINTER_2024: {
        id: 'winter_2024',
        name: 'Winter 2024',
        description: 'Active during Winter 2024',
        emoji: '❄️',
        color: '#06b6d4',
        icon: 'Snowflake'
    }
};

// Get badges for a user
export const getUserBadges = (user) => {
    const badges = [];

    if (!user) return badges;

    // Check for developer/admin (hardcoded for super admin)
    if (user.email === 'glennhosting1@gmail.com') {
        badges.push(BADGES.DEVELOPER);
        badges.push(BADGES.ADMIN);
    }

    // Check for user's stored badges
    if (user.badges && Array.isArray(user.badges)) {
        user.badges.forEach(badgeId => {
            const badge = Object.values(BADGES).find(b => b.id === badgeId);
            if (badge && !badges.includes(badge)) {
                badges.push(badge);
            }
        });
    }

    // Check for early supporter (joined before a certain date)
    if (user.createdAt) {
        const joinDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        const cutoffDate = new Date('2025-01-01');
        if (joinDate < cutoffDate) {
            badges.push(BADGES.EARLY_SUPPORTER);
        }
    }

    // Check for premium status
    if (user.premium) {
        badges.push(BADGES.PREMIUM);
    }

    // Check for verified status
    if (user.verified) {
        badges.push(BADGES.VERIFIED);
    }

    // Check for bot status
    if (user.isBot) {
        badges.push(BADGES.BOT);
    }

    // Message milestones
    if (user.messageCount >= 10000) {
        badges.push(BADGES.MESSAGES_10000);
    } else if (user.messageCount >= 1000) {
        badges.push(BADGES.MESSAGES_1000);
    } else if (user.messageCount >= 100) {
        badges.push(BADGES.MESSAGES_100);
    }

    return badges;
};

// Render badge component props
export const getBadgeStyle = (badge) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${badge.color}20`,
    color: badge.color,
    borderRadius: '4px',
    padding: '2px 4px',
    fontSize: '12px',
    fontWeight: 600,
    marginLeft: '4px',
    cursor: 'help'
});
