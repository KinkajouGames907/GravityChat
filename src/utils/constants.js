// Message limits
export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGE_COOLDOWN_MS = 1000; // 1 second between messages
export const TYPING_TIMEOUT_MS = 3000;
export const TYPING_INDICATOR_TTL_MS = 5000;

// File upload limits
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_GIF_SIZE = 15 * 1024 * 1024; // 15MB
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (reduced from 500MB - base64 in Firestore is impractical for large files)

// Presence
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
export const PRESENCE_UPDATE_INTERVAL_MS = 60000; // 1 minute

// Message retention
export const MESSAGE_RETENTION_MONTHS = 4;

// Invite codes
export const INVITE_CODE_LENGTH = 10;

// Pagination
export const SERVERS_PER_PAGE = 50;
export const USERS_SEARCH_LIMIT = 20;
export const FIRESTORE_IN_LIMIT = 30;

// Quick reactions
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👀', '🎉'];
