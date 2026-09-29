import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import {
  adminUserSearchQuerySchema,
  adminUserIdParamSchema,
  adminSuspendUserSchema,
  adminRestoreUserSchema,
  adminRevokeSessionsSchema,
  type AdminUserSearchQueryInput,
  type AdminUserIdParamInput,
  type AdminSuspendUserInput,
  type AdminRestoreUserInput,
  type AdminRevokeSessionsInput,
} from '@platform/validation';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard.js';
import { RequirePermissions } from '../decorators/admin-permissions.decorator.js';
import {
  CurrentAdmin,
  type AuthenticatedAdminPrincipal,
} from '../decorators/current-admin.decorator.js';
import { AdminUsersService } from '../services/admin-users.service.js';
import type {
  AdminUserSummaryDto,
  AdminUserDetailDto,
  AdminActionResponse,
} from '@platform/api-contracts';

@ApiTags('Admin Users & Account Operations')
@Controller('v1/admin/users')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    @Inject(AdminUsersService)
    private readonly adminUsersService: AdminUsersService
  ) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Search and filter consumer user accounts' })
  async searchUsers(
    @Query(new AppValidationPipe(adminUserSearchQuerySchema)) query: AdminUserSearchQueryInput
  ): Promise<{ items: AdminUserSummaryDto[]; nextCursor: string | null; hasMore: boolean }> {
    return this.adminUsersService.searchUsers(query);
  }

  @Get(':userId')
  @RequirePermissions('users.read')
  @ApiOperation({
    summary: 'Get detailed consumer user record, profile, safety stats, restrictions',
  })
  async getUserDetail(
    @Param(new AppValidationPipe(adminUserIdParamSchema)) params: AdminUserIdParamInput
  ): Promise<{ user: AdminUserDetailDto }> {
    const user = await this.adminUsersService.getUserDetail(params.userId);
    return { user };
  }

  @Post(':userId/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.suspend')
  @ApiOperation({ summary: 'Suspend user account and revoke active sessions (Mandatory Reason)' })
  async suspendUser(
    @Param(new AppValidationPipe(adminUserIdParamSchema)) params: AdminUserIdParamInput,
    @Body(new AppValidationPipe(adminSuspendUserSchema)) body: AdminSuspendUserInput,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
    @Req() req: Request
  ): Promise<AdminActionResponse> {
    const reqId = req.headers['x-request-id'] as string | undefined;
    const ua = req.headers['user-agent'] as string | undefined;
    return this.adminUsersService.suspendUser(params.userId, body, admin, req.ip, ua, reqId);
  }

  @Post(':userId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.restore')
  @ApiOperation({ summary: 'Restore suspended user account to active status (Mandatory Reason)' })
  async restoreUser(
    @Param(new AppValidationPipe(adminUserIdParamSchema)) params: AdminUserIdParamInput,
    @Body(new AppValidationPipe(adminRestoreUserSchema)) body: AdminRestoreUserInput,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
    @Req() req: Request
  ): Promise<AdminActionResponse> {
    const reqId = req.headers['x-request-id'] as string | undefined;
    const ua = req.headers['user-agent'] as string | undefined;
    return this.adminUsersService.restoreUser(params.userId, body, admin, req.ip, ua, reqId);
  }

  @Post(':userId/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.sessions.revoke')
  @ApiOperation({ summary: 'Forcefully revoke all active sessions for a user (Mandatory Reason)' })
  async revokeSessions(
    @Param(new AppValidationPipe(adminUserIdParamSchema)) params: AdminUserIdParamInput,
    @Body(new AppValidationPipe(adminRevokeSessionsSchema)) body: AdminRevokeSessionsInput,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
    @Req() req: Request
  ): Promise<AdminActionResponse> {
    const reqId = req.headers['x-request-id'] as string | undefined;
    const ua = req.headers['user-agent'] as string | undefined;
    return this.adminUsersService.revokeSessions(params.userId, body, admin, req.ip, ua, reqId);
  }
}
