import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { AppValidationPipe } from '../../../common/pipes/app-validation.pipe.js';
import { adminLoginSchema, type AdminLoginInput } from '@platform/validation';
import { AdminAuthService } from '../services/admin-auth.service.js';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import {
  CurrentAdmin,
  type AuthenticatedAdminPrincipal,
} from '../decorators/current-admin.decorator.js';
import type {
  AdminLoginResponse,
  AdminMeResponse,
  AdminSessionDto,
  AdminLogoutResponse,
} from '@platform/api-contracts';

@ApiTags('Admin Operations & Control Plane')
@Controller('v1/admin/auth')
export class AdminAuthController {
  constructor(
    @Inject(AdminAuthService)
    private readonly adminAuthService: AdminAuthService
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate administrative staff credentials' })
  async login(
    @Body(new AppValidationPipe(adminLoginSchema)) body: AdminLoginInput,
    @Req() req: Request
  ): Promise<AdminLoginResponse> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.adminAuthService.login(body, req.ip, userAgent);
  }

  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current administrative staff profile and permissions' })
  async getProfile(@CurrentAdmin() admin: AuthenticatedAdminPrincipal): Promise<AdminMeResponse> {
    const profile = await this.adminAuthService.getAdminProfile(admin.adminId);
    return {
      admin: profile,
      sessionId: admin.sessionId,
    };
  }

  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke current administrative session' })
  async logout(@CurrentAdmin() admin: AuthenticatedAdminPrincipal): Promise<AdminLogoutResponse> {
    await this.adminAuthService.logout(admin.sessionId);
    return { success: true };
  }

  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all active administrative sessions for the current operator' })
  async logoutAll(
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal
  ): Promise<AdminLogoutResponse> {
    await this.adminAuthService.logoutAll(admin.adminId);
    return { success: true };
  }

  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for current administrative staff user' })
  async listSessions(
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal
  ): Promise<{ sessions: AdminSessionDto[] }> {
    const sessions = await this.adminAuthService.getActiveSessions(admin.adminId, admin.sessionId);
    return { sessions };
  }
}
