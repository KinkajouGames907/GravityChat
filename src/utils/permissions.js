export const SUPER_ADMIN_EMAIL = 'albertderek6878@gmail.com';

export const PERMISSIONS = {
    MANAGE_SERVER: 'MANAGE_SERVER',
    MANAGE_ROLES: 'MANAGE_ROLES',
    MANAGE_CHANNELS: 'MANAGE_CHANNELS',
    KICK_MEMBERS: 'KICK_MEMBERS',
    BAN_MEMBERS: 'BAN_MEMBERS',
};

export function isSuperAdmin(user) {
    if (!user) return false;
    if (user.email === SUPER_ADMIN_EMAIL) return true;
    if (user.superAdminTeam === true) return true;
    return false;
}

export function isServerOwner(user, server) {
    return user?.uid === server?.ownerId;
}

/**
 * Checks if a user has access to the Update Center.
 * Super admins always have access. Other users need to be listed in
 * the Firestore updateCenter/config.authorizedEmails array.
 *
 * @param {object} user - currentUser from AuthContext
 * @param {string[]} authorizedEmails - The array from Firestore updateCenter/config
 */
export function isUpdateCenterUser(user, authorizedEmails = []) {
    if (!user) return false;
    if (isSuperAdmin(user)) return true;
    return Array.isArray(authorizedEmails) && authorizedEmails.includes(user.email);
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
