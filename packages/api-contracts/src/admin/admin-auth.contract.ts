/**
 * Admin Authentication Contract
 * Staff identity authentication, session management, and credential exchange.
 */
import type { AdminPermissionName, AdminRoleName } from './admin-rbac.contract.js';

export interface AdminLoginRequest {
  readonly email: string;
  readonly password: string;
  readonly mfaCode?: string;
}

export interface AdminProfileDto {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isActive: boolean;
  readonly mfaEnabled: boolean;
  readonly roles: readonly AdminRoleName[];
  readonly permissions: readonly AdminPermissionName[];
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface AdminLoginResponse {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly admin: AdminProfileDto;
  readonly sessionId: string;
}

export interface AdminMeResponse {
  readonly admin: AdminProfileDto;
  readonly sessionId: string;
}

export interface AdminSessionDto {
  readonly id: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: string;
  readonly lastActiveAt: string | null;
  readonly createdAt: string;
  readonly isCurrent: boolean;
}

export interface AdminLogoutResponse {
  readonly success: boolean;
}
