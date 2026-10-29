import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  type AuthTokensResponse,
  type GenericAuthNoticeResponse,
  type SessionItemResponse,
  type DeviceItemResponse,
  type RefreshTokenResponse,
  type LogoutResponse,
  type RevokeSessionResponse,
  type RevokeDeviceResponse,
  type PasskeyRegisterOptionsResponse,
  type PasskeyLoginOptionsResponse,
  type VerifyOtpPayload,
  type VerifyEmailPayload,
  type GoogleAuthPayload,
  type AppleAuthPayload,
  type FirebaseAuthPayload,
  type PasskeyRegisterVerifyPayload,
  type PasskeyLoginVerifyPayload,
  type DeviceRegistrationPayload,
  type CheckIdentifierPayload,
  type CheckIdentifierResponse,
  ErrorCode,
} from '@platform/api-contracts';
import { AppValidationPipe } from '../../common/pipes/app-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AuthService } from './services/auth.service.js';
import { PasskeyService } from './providers/passkey.service.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
  requestEmailSchema,
  verifyEmailSchema,
  checkIdentifierSchema,
  googleAuthSchema,
  appleAuthSchema,
  firebaseAuthSchema,
  refreshTokenSchema,
  passkeyRegisterVerifySchema,
  passkeyLoginOptionsSchema,
  passkeyLoginVerifySchema,
  deviceRegistrationSchema,
} from './dto/auth.dto.js';

@ApiTags('Authentication & Identity')
@Controller('v1/auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(PasskeyService)
    private readonly passkeyService: PasskeyService
  ) {}

  /**
   * Gate 1A: fail-closed kill switch for identity-federation providers that do
   * not yet perform cryptographic verification (signature checks land in
   * Gate 1B). When disabled (the default in every environment), the endpoint
   * rejects before any token parsing, so no session can be established through
   * an unverified path.
   */
  private assertProviderEnabled(
    providerDisplayName: string,
    enabled: boolean,
    remediationGate: string
  ): void {
    if (!enabled) {
      throw new HttpException(
        {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `${providerDisplayName} sign-in is temporarily disabled pending security hardening (${remediationGate}).`,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  // ----------------------------------------------------
  // Phone OTP Endpoints
  // ----------------------------------------------------

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request phone number OTP challenge' })
  @SwaggerResponse({ status: 200, description: 'Generic verification notice' })
  async requestOtp(
    @Body(new AppValidationPipe(requestOtpSchema)) body: { phoneNumber: string; deviceId?: string },
    @Req() req: Request
  ): Promise<GenericAuthNoticeResponse> {
    return this.authService.requestOtp(body.phoneNumber, req.ip, body.deviceId);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone number OTP and create session' })
  @SwaggerResponse({ status: 200, description: 'Authenticated session tokens' })
  async verifyOtp(
    @Body(new AppValidationPipe(verifyOtpSchema))
    body: VerifyOtpPayload,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    const userAgent = req.headers['user-agent'];
    return this.authService.verifyOtp(body.phoneNumber, body.code, body.device, req.ip, userAgent);
  }

  // ----------------------------------------------------
  // Email Passwordless Endpoints
  // ----------------------------------------------------

  @Public()
  @Post('email/request-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request email verification challenge' })
  @SwaggerResponse({ status: 200, description: 'Generic verification notice' })
  async requestEmailVerification(
    @Body(new AppValidationPipe(requestEmailSchema)) body: { email: string },
    @Req() req: Request
  ): Promise<GenericAuthNoticeResponse> {
    return this.authService.requestEmailVerification(body.email, req.ip);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email challenge and create session' })
  @SwaggerResponse({ status: 200, description: 'Authenticated session tokens' })
  async verifyEmail(
    @Body(new AppValidationPipe(verifyEmailSchema))
    body: VerifyEmailPayload,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    const userAgent = req.headers['user-agent'];
    return this.authService.verifyEmail(body.email, body.code, body.device, req.ip, userAgent);
  }

  // ----------------------------------------------------
  // Identifier Existence Check (Anti-Enumeration Guarded)
  // ----------------------------------------------------

  @Public()
  @Post('check-identifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if phone or email is registered (with anti-enumeration timing normalization)',
  })
  @SwaggerResponse({ status: 200, description: 'Identifier check outcome' })
  async checkIdentifier(
    @Body(new AppValidationPipe(checkIdentifierSchema)) body: CheckIdentifierPayload
  ): Promise<CheckIdentifierResponse> {
    return this.authService.checkIdentifier(body.identifier, body.type);
  }

  // ----------------------------------------------------
  // OAuth / OIDC Endpoints (Google & Apple)
  // ----------------------------------------------------

  @Public()
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Google ID token or code' })
  @SwaggerResponse({ status: 200, description: 'Authenticated session tokens' })
  async loginWithGoogle(
    @Body(new AppValidationPipe(googleAuthSchema)) body: GoogleAuthPayload,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    this.assertProviderEnabled(
      'Google OAuth',
      this.configService.authGoogleOAuthEnabled,
      'Gate 1B'
    );
    const userAgent = req.headers['user-agent'];
    return this.authService.loginWithGoogle(body, req.ip, userAgent);
  }

  @Public()
  @Post('oauth/apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Apple ID token or code' })
  @SwaggerResponse({ status: 200, description: 'Authenticated session tokens' })
  async loginWithApple(
    @Body(new AppValidationPipe(appleAuthSchema)) body: AppleAuthPayload,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    this.assertProviderEnabled('Apple OAuth', this.configService.authAppleOAuthEnabled, 'Gate 1B');
    const userAgent = req.headers['user-agent'];
    return this.authService.loginWithApple(body, req.ip, userAgent);
  }

  // ----------------------------------------------------
  // Firebase Auth Endpoints (Phone OTP & Email)
  // ----------------------------------------------------

  @Public()
  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Firebase ID token (Phone OTP or Email)' })
  @SwaggerResponse({ status: 200, description: 'Authenticated session tokens' })
  async loginWithFirebase(
    @Body(new AppValidationPipe(firebaseAuthSchema)) body: FirebaseAuthPayload,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    const userAgent = req.headers['user-agent'];
    return this.authService.loginWithFirebase(body, req.ip, userAgent);
  }

  // ----------------------------------------------------
  // Passkey Endpoints (WebAuthn)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Post('passkey/register/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate WebAuthn registration options for current user' })
  async getPasskeyRegisterOptions(
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<PasskeyRegisterOptionsResponse> {
    this.assertProviderEnabled('Passkey', this.configService.authPasskeyEnabled, 'Gate 1B');
    return this.passkeyService.createRegistrationOptions(user.userId);
  }

  @ApiBearerAuth()
  @Post('passkey/register/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Verify and persist new passkey credential' })
  async verifyPasskeyRegistration(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new AppValidationPipe(passkeyRegisterVerifySchema)) body: PasskeyRegisterVerifyPayload
  ): Promise<{ credentialId: string }> {
    this.assertProviderEnabled('Passkey', this.configService.authPasskeyEnabled, 'Gate 1B');
    const cred = await this.passkeyService.verifyRegistration(user.userId, body);
    return { credentialId: cred.credentialId };
  }

  @Public()
  @Post('passkey/login/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate WebAuthn assertion challenge options for login' })
  async getPasskeyLoginOptions(
    @Body(new AppValidationPipe(passkeyLoginOptionsSchema)) body: { emailOrPhone?: string }
  ): Promise<PasskeyLoginOptionsResponse> {
    this.assertProviderEnabled('Passkey', this.configService.authPasskeyEnabled, 'Gate 1B');
    return this.passkeyService.createLoginOptions(body.emailOrPhone);
  }

  @Public()
  @Post('passkey/login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify WebAuthn assertion response and establish session' })
  async verifyPasskeyLogin(
    @Body(new AppValidationPipe(passkeyLoginVerifySchema)) body: PasskeyLoginVerifyPayload,
    @Req() req: Request
  ): Promise<AuthTokensResponse> {
    this.assertProviderEnabled('Passkey', this.configService.authPasskeyEnabled, 'Gate 1B');
    const credential = await this.passkeyService.verifyLogin(body);
    const userAgent = req.headers['user-agent'];
    return this.authService.createSessionForPasskeyUser(
      credential.userId,
      body.device,
      req.ip,
      userAgent
    );
  }

  // ----------------------------------------------------
  // Refresh & Session Rotation
  // ----------------------------------------------------

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new short-lived access token' })
  @SwaggerResponse({ status: 200, description: 'Rotated refresh token and access token' })
  async refresh(
    @Body(new AppValidationPipe(refreshTokenSchema)) body: { refreshToken: string },
    @Req() req: Request
  ): Promise<RefreshTokenResponse> {
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshSession(body.refreshToken, req.ip, userAgent);
  }

  // ----------------------------------------------------
  // Logout Endpoints
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser() user: AuthenticatedPrincipal): Promise<LogoutResponse> {
    return this.authService.logout(user.sessionId, user.userId);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all active sessions for the user' })
  async logoutAll(@CurrentUser() user: AuthenticatedPrincipal): Promise<LogoutResponse> {
    return this.authService.logoutAll(user.userId);
  }

  // ----------------------------------------------------
  // Session Management (Self-Service)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for the authenticated user' })
  async listSessions(@CurrentUser() user: AuthenticatedPrincipal): Promise<SessionItemResponse[]> {
    return this.authService.listUserSessions(user.userId, user.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke a specific session owned by the authenticated user' })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<RevokeSessionResponse> {
    return this.authService.revokeUserSession(user.userId, sessionId);
  }

  // ----------------------------------------------------
  // Device Management (Self-Service)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Get('devices')
  @ApiOperation({ summary: 'List registered devices for the authenticated user' })
  async listDevices(@CurrentUser() user: AuthenticatedPrincipal): Promise<DeviceItemResponse[]> {
    return this.authService.listUserDevices(user.userId);
  }

  @ApiBearerAuth()
  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new device for the authenticated user' })
  async registerDevice(
    @Body(new AppValidationPipe(deviceRegistrationSchema)) body: DeviceRegistrationPayload,
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<DeviceItemResponse> {
    return this.authService.registerDevice(user.userId, body);
  }

  @ApiBearerAuth()
  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Revoke a registered device owned by the authenticated user' })
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedPrincipal
  ): Promise<RevokeDeviceResponse> {
    return this.authService.revokeUserDevice(user.userId, deviceId);
  }

  // ----------------------------------------------------
  // Self-Service Account Deletion (Apple Guideline 5.1.1(v) & Google Play Policy)
  // ----------------------------------------------------

  @ApiBearerAuth()
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request permanent account deletion and revoke all active sessions' })
  @SwaggerResponse({ status: 200, description: 'Account deletion confirmation' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Req() req: Request
  ): Promise<{ success: boolean; message: string }> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.deleteUserAccount(user.userId, req.ip, userAgent);
  }
}
