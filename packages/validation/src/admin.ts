import { z } from 'zod';
import { uuidSchema } from './chat.js';

export const adminLoginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  mfaCode: z.string().trim().length(6, 'MFA code must be 6 digits').optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminUserSearchQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED']).optional(),
  sort: z.enum(['createdAt', 'lastActiveAt', 'reportsCount']).default('createdAt').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export type AdminUserSearchQueryInput = z.infer<typeof adminUserSearchQuerySchema>;

export const adminUserIdParamSchema = z.object({
  userId: uuidSchema,
});

export type AdminUserIdParamInput = z.infer<typeof adminUserIdParamSchema>;

/**
 * Mandatory Reason Invariant:
 * Every administrative action modifying user state or platform state must provide an explicit reason.
 */
export const adminSuspendUserSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(1000),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
});

export type AdminSuspendUserInput = z.infer<typeof adminSuspendUserSchema>;

export const adminRestoreUserSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(1000),
});

export type AdminRestoreUserInput = z.infer<typeof adminRestoreUserSchema>;

export const adminRevokeSessionsSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(1000),
});

export type AdminRevokeSessionsInput = z.infer<typeof adminRevokeSessionsSchema>;

export const adminModerationCaseQuerySchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'RESOLVED', 'DISMISSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedAdminId: uuidSchema.optional(),
  subjectType: z
    .enum(['USER', 'PROFILE', 'POST', 'COMMENT', 'COMMUNITY', 'EVENT', 'MESSAGE'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export type AdminModerationCaseQueryInput = z.infer<typeof adminModerationCaseQuerySchema>;

export const adminModerationCaseIdParamSchema = z.object({
  caseId: uuidSchema,
});

export type AdminModerationCaseIdParamInput = z.infer<typeof adminModerationCaseIdParamSchema>;

export const adminAssignModerationCaseSchema = z.object({
  assignedAdminId: uuidSchema,
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(1000),
});

export type AdminAssignModerationCaseInput = z.infer<typeof adminAssignModerationCaseSchema>;

export const adminDecideModerationCaseSchema = z.object({
  action: z.enum(['NO_ACTION', 'WARNING', 'SUSPEND', 'BAN', 'CONTENT_REMOVAL']),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(1000),
  notes: z.string().trim().max(2000).optional(),
});

export type AdminDecideModerationCaseInput = z.infer<typeof adminDecideModerationCaseSchema>;

export const adminReportQuerySchema = z.object({
  status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).optional(),
  targetType: z
    .enum(['USER', 'PROFILE', 'POST', 'COMMENT', 'COMMUNITY', 'EVENT', 'MESSAGE'])
    .optional(),
  reportedUserId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export type AdminReportQueryInput = z.infer<typeof adminReportQuerySchema>;

export const adminReportIdParamSchema = z.object({
  reportId: uuidSchema,
});

export type AdminReportIdParamInput = z.infer<typeof adminReportIdParamSchema>;

export const adminResolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionAction: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(1000),
});

export type AdminResolveReportInput = z.infer<typeof adminResolveReportSchema>;

export const adminAuditLogQuerySchema = z.object({
  actorAdminId: uuidSchema.optional(),
  action: z.string().trim().max(128).optional(),
  resourceType: z.string().trim().max(64).optional(),
  resourceId: z.string().trim().max(128).optional(),
  isBreakGlass: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export type AdminAuditLogQueryInput = z.infer<typeof adminAuditLogQuerySchema>;

export const adminSecurityEventQuerySchema = z.object({
  userId: uuidSchema.optional(),
  eventType: z.string().trim().max(64).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export type AdminSecurityEventQueryInput = z.infer<typeof adminSecurityEventQuerySchema>;
