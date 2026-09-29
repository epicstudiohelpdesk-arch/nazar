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
  adminModerationCaseQuerySchema,
  adminModerationCaseIdParamSchema,
  adminAssignModerationCaseSchema,
  adminDecideModerationCaseSchema,
  adminReportQuerySchema,
  adminReportIdParamSchema,
  adminResolveReportSchema,
  type AdminModerationCaseQueryInput,
  type AdminModerationCaseIdParamInput,
  type AdminAssignModerationCaseInput,
  type AdminDecideModerationCaseInput,
  type AdminReportQueryInput,
  type AdminReportIdParamInput,
  type AdminResolveReportInput,
} from '@platform/validation';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { AdminPermissionsGuard } from '../guards/admin-permissions.guard.js';
import { RequirePermissions } from '../decorators/admin-permissions.decorator.js';
import {
  CurrentAdmin,
  type AuthenticatedAdminPrincipal,
} from '../decorators/current-admin.decorator.js';
import { AdminModerationService } from '../services/admin-moderation.service.js';
import type {
  AdminModerationCaseDto,
  AdminReportDto,
  AdminModerationDecisionResponse,
} from '@platform/api-contracts';

@ApiTags('Admin Moderation & Safety Operations')
@Controller('v1/admin')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
@ApiBearerAuth()
export class AdminModerationController {
  constructor(
    @Inject(AdminModerationService)
    private readonly moderationService: AdminModerationService
  ) {}

  @Get('moderation/cases')
  @RequirePermissions('moderation.read')
  @ApiOperation({ summary: 'List and filter open moderation cases' })
  async getModerationCases(
    @Query(new AppValidationPipe(adminModerationCaseQuerySchema))
    query: AdminModerationCaseQueryInput
  ): Promise<{ items: AdminModerationCaseDto[]; nextCursor: string | null; hasMore: boolean }> {
    return this.moderationService.getModerationCases(query);
  }

  @Post('moderation/cases/:caseId/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('moderation.assign')
  @ApiOperation({ summary: 'Assign moderation case to staff reviewer (Mandatory Reason)' })
  async assignCase(
    @Param(new AppValidationPipe(adminModerationCaseIdParamSchema))
    params: AdminModerationCaseIdParamInput,
    @Body(new AppValidationPipe(adminAssignModerationCaseSchema))
    body: AdminAssignModerationCaseInput,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
    @Req() req: Request
  ): Promise<AdminModerationDecisionResponse> {
    const reqId = req.headers['x-request-id'] as string | undefined;
    const ua = req.headers['user-agent'] as string | undefined;
    return this.moderationService.assignCase(params.caseId, body, admin, req.ip, ua, reqId);
  }

  @Post('moderation/cases/:caseId/decide')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('moderation.decide')
  @ApiOperation({ summary: 'Render binding decision on moderation case (Mandatory Reason)' })
  async decideCase(
    @Param(new AppValidationPipe(adminModerationCaseIdParamSchema))
    params: AdminModerationCaseIdParamInput,
    @Body(new AppValidationPipe(adminDecideModerationCaseSchema))
    body: AdminDecideModerationCaseInput,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
    @Req() req: Request
  ): Promise<AdminModerationDecisionResponse> {
    const reqId = req.headers['x-request-id'] as string | undefined;
    const ua = req.headers['user-agent'] as string | undefined;
    return this.moderationService.decideCase(params.caseId, body, admin, req.ip, ua, reqId);
  }

  @Get('reports')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'List and filter platform reports across targets' })
  async getReports(
    @Query(new AppValidationPipe(adminReportQuerySchema)) query: AdminReportQueryInput
  ): Promise<{ items: AdminReportDto[]; nextCursor: string | null; hasMore: boolean }> {
    return this.moderationService.getReports(query);
  }

  @Post('reports/:reportId/resolve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('reports.resolve')
  @ApiOperation({ summary: 'Directly resolve or dismiss a user report (Mandatory Reason)' })
  async resolveReport(
    @Param(new AppValidationPipe(adminReportIdParamSchema)) params: AdminReportIdParamInput,
    @Body(new AppValidationPipe(adminResolveReportSchema)) body: AdminResolveReportInput,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
    @Req() req: Request
  ): Promise<AdminModerationDecisionResponse> {
    const reqId = req.headers['x-request-id'] as string | undefined;
    const ua = req.headers['user-agent'] as string | undefined;
    return this.moderationService.resolveReport(params.reportId, body, admin, req.ip, ua, reqId);
  }
}
