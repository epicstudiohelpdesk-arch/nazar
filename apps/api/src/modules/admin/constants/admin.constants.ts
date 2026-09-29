export const ADMIN_USERS_REPOSITORY_TOKEN = Symbol('IAdminUsersRepository');
export const ADMIN_ROLES_REPOSITORY_TOKEN = Symbol('IAdminRolesRepository');
export const ADMIN_SESSIONS_REPOSITORY_TOKEN = Symbol('IAdminSessionsRepository');
export const ADMIN_AUDIT_LOGS_REPOSITORY_TOKEN = Symbol('IAdminAuditLogsRepository');

export const ADMIN_TOKEN_EXPIRATION_SECONDS = 3600; // 1 hour access token
export const ADMIN_JWT_SECRET_FALLBACK = 'nazar-dev-super-secure-admin-secret-2026-production';
