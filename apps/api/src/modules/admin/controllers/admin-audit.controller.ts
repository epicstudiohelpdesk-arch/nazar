import { Controller, Get, Query, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import {
  adminAuditLogQuerySchema,
  adminSecurityEventQuerySchema,
  type AdminAuditLogQueryInput,
  type AdminSecurityEventQueryInput,
} from '@platform/validation';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard.js';
import { RequirePermissions } from '../decorators/admin-permissions.decorator.js';
import { AdminAuditService } from '../services/admin-audit.service.js';
import type { AdminAuditLogDto, AdminSecurityEventDto } from '@platform/api-contracts';

@ApiTags('Admin Audit Trail & Security Events')
@Controller('v1/admin/audit')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
@ApiBearerAuth()
export class AdminAuditController {
  constructor(
    @Inject(AdminAuditService)
    private readonly auditService: AdminAuditService
  ) {}

  @Get('logs')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Query append-only immutable administrative audit trail' })
  async getAuditLogs(
    @Query(new AppValidationPipe(adminAuditLogQuerySchema)) query: AdminAuditLogQueryInput
  ): Promise<{ items: AdminAuditLogDto[]; nextCursor: string | null; hasMore: boolean }> {
    return this.auditService.getAuditLogs(query);
  }

  @Get('security-events')
  @RequirePermissions('security.events.read')
  @ApiOperation({ summary: 'Query platform security events and telemetry' })
  async getSecurityEvents(
    @Query(new AppValidationPipe(adminSecurityEventQuerySchema)) query: AdminSecurityEventQueryInput
  ): Promise<{ items: AdminSecurityEventDto[]; nextCursor: string | null; hasMore: boolean }> {
    return this.auditService.getSecurityEvents(query);
  }
}
