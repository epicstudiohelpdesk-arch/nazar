export const ADMIN_USERS_REPOSITORY_TOKEN = Symbol('IAdminUsersRepository');
export const ADMIN_ROLES_REPOSITORY_TOKEN = Symbol('IAdminRolesRepository');
export const ADMIN_SESSIONS_REPOSITORY_TOKEN = Symbol('IAdminSessionsRepository');
export const ADMIN_AUDIT_LOGS_REPOSITORY_TOKEN = Symbol('IAdminAuditLogsRepository');

export const ADMIN_TOKEN_EXPIRATION_SECONDS = 3600; // 1 hour access token

// Gate 1A: the hard-coded ADMIN_JWT_SECRET_FALLBACK was removed. Administrative
// tokens are signed exclusively with the validated JWT_ACCESS_SECRET; startup
// validation (packages/config) fails closed when it is missing or dev-default
// outside development/test environments.
