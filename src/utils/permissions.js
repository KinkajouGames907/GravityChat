// Super admin email loaded from environment variable for security
const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || '';

export const PERMISSIONS = {
    MANAGE_SERVER: 'MANAGE_SERVER',
    MANAGE_ROLES: 'MANAGE_ROLES',
    MANAGE_CHANNELS: 'MANAGE_CHANNELS',
    KICK_MEMBERS: 'KICK_MEMBERS',
    BAN_MEMBERS: 'BAN_MEMBERS',
    MANAGE_MESSAGES: 'MANAGE_MESSAGES',
    PIN_MESSAGES: 'PIN_MESSAGES',
};

export function isSuperAdmin(user) {
    if (!user) return false;
    // Only the primary super admin email (from env) is trusted unconditionally
    if (SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL) return true;
    // Team members must have the flag set in Firestore (not client-editable via DevTools
    // because the AuthContext merges Firestore data which overrides any client tampering)
    if (user.superAdminTeam === true && user.superAdminVerified === true) return true;
    return false;
}

export function isServerOwner(user, server) {
    return user?.uid === server?.ownerId;
}

export function hasPermission(user, server, member, permission) {
    if (!user || !server) return false;
    if (isSuperAdmin(user)) return true;
    if (isServerOwner(user, server)) return true;

    if (!member || !member.roles) return false;

    // Find user's roles in the server's roles list
    const serverRoles = server.roles || [];
    const userRoleIds = member.roles;

    for (const roleId of userRoleIds) {
        const role = serverRoles.find(r => r.id === roleId);
        if (role && role.permissions?.includes(permission)) {
            return true;
        }
        // Admin role usually has all permissions, but let's be explicit with the permission string 'ADMIN' or just check all
        if (role && role.permissions?.includes('ADMIN')) {
            return true;
        }
    }

    return false;
}
