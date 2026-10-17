import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  AuthEventType,
  type AuthTokensResponse,
  type SessionItemResponse,
  type DeviceItemResponse,
  type DeviceRegistrationPayload,
  type GoogleAuthPayload,
  type AppleAuthPayload,
  type FirebaseAuthPayload,
  type RefreshTokenResponse,
  type LogoutResponse,
  type RevokeSessionResponse,
  type RevokeDeviceResponse,
  type ClientPlatform,
  type CheckIdentifierResponse,
} from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  users,
  profiles,
  devices,
  type DeviceRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import { TOKEN_SERVICE_TOKEN, type ITokenService } from '../tokens/token.interface.js';
import {
  GOOGLE_OAUTH_PROVIDER_TOKEN,
  APPLE_OAUTH_PROVIDER_TOKEN,
  type IOAuthProvider,
} from '../providers/oauth.provider.js';
import {
  FIREBASE_AUTH_PROVIDER_TOKEN,
  type IFirebaseAuthProvider,
} from '../providers/firebase.provider.js';
import {
  USER_IDENTITY_REPOSITORY_TOKEN,
  type IUserIdentityRepository,
} from '../repositories/user-identity.repository.js';
import {
  SESSION_REPOSITORY_TOKEN,
  type ISessionRepository,
} from '../repositories/session.repository.js';
import {
  DEVICE_REPOSITORY_TOKEN,
  type IDeviceRepository,
} from '../repositories/device.repository.js';
import { AuthSecurityService } from './auth-security.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
    @Inject(GOOGLE_OAUTH_PROVIDER_TOKEN)
    private readonly googleProvider: IOAuthProvider,
    @Inject(APPLE_OAUTH_PROVIDER_TOKEN)
    private readonly appleProvider: IOAuthProvider,
    @Inject(FIREBASE_AUTH_PROVIDER_TOKEN)
    private readonly firebaseProvider: IFirebaseAuthProvider,
    @Inject(USER_IDENTITY_REPOSITORY_TOKEN)
    private readonly userIdentityRepo: IUserIdentityRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepo: ISessionRepository,
    @Inject(DEVICE_REPOSITORY_TOKEN)
    private readonly deviceRepo: IDeviceRepository,
    @Inject(AuthSecurityService)
    private readonly securityService: AuthSecurityService
  ) {}

  // ----------------------------------------------------
  // Identifier Existence Check (Anti-Enumeration Guarded)
  // ----------------------------------------------------

  async checkIdentifier(
    identifier: string,
    type?: 'PHONE' | 'EMAIL'
  ): Promise<CheckIdentifierResponse> {
    const startTime = Date.now();
    const identity = await this.userIdentityRepo.findByIdentifier(identifier, type);

    let exists = false;
    let provider: CheckIdentifierResponse['provider'] = undefined;

    if (identity) {
      const userRows = await this.databaseService.client
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, identity.userId))
        .limit(1);

      const status = userRows[0]?.status;
      if (status && status !== 'DELETED') {
        exists = true;
        provider = identity.provider as CheckIdentifierResponse['provider'];
      }
    }

    // Security Defense (Timing attack mitigation):
    // Standardize processing time with artificial jitter to defeat side-channel analysis
    const elapsed = Date.now() - startTime;
    const targetMinDelay = 50 + Math.floor(Math.random() * 20);
    if (elapsed < targetMinDelay) {
      await new Promise((resolve) => setTimeout(resolve, targetMinDelay - elapsed));
    }

    return {
      exists,
      provider: exists ? provider : undefined,
    };
  }

  // ----------------------------------------------------
  // OAuth Flow (Google & Apple)
  // ----------------------------------------------------

  async loginWithGoogle(
    payload: GoogleAuthPayload,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokensResponse> {
    const result = await this.googleProvider.validateToken(payload);

    return this.resolveOrCreateUserAndSession({
      provider: 'GOOGLE',
      providerSubject: result.providerSubject,
      email: result.email,
      emailVerified: result.emailVerified,
      devicePayload: payload.device,
      ipAddress,
      userAgent,
      eventOnSuccess: AuthEventType.AUTH_OAUTH_LOGIN,
    });
  }

  async loginWithApple(
    payload: AppleAuthPayload,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokensResponse> {
    const result = await this.appleProvider.validateToken(payload);

    return this.resolveOrCreateUserAndSession({
      provider: 'APPLE',
      providerSubject: result.providerSubject,
      email: result.email,
      emailVerified: result.emailVerified,
      devicePayload: payload.device,
      ipAddress,
      userAgent,
      eventOnSuccess: AuthEventType.AUTH_OAUTH_LOGIN,
    });
  }

  // ----------------------------------------------------
  // Firebase Auth Flow
  // ----------------------------------------------------

  async loginWithFirebase(
    payload: FirebaseAuthPayload,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokensResponse> {
    const result = await this.firebaseProvider.verifyIdToken(payload.idToken);

    let provider: 'PHONE' | 'EMAIL' | 'FIREBASE';
    let providerSubject: string;

    if (result.phoneNumber) {
      provider = 'PHONE';
      providerSubject = result.phoneNumber;
    } else if (result.email) {
      provider = 'EMAIL';
      providerSubject = result.email;
    } else {
      provider = 'FIREBASE';
      providerSubject = result.uid;
    }

    return this.resolveOrCreateUserAndSession({
      provider,
      providerSubject,
      email: result.email,
      emailVerified: result.emailVerified,
      devicePayload: payload.device,
      ipAddress,
      userAgent,
      eventOnSuccess: AuthEventType.AUTH_FIREBASE_VERIFIED,
    });
  }

  // ----------------------------------------------------
  // Passkey Login Session Helper
  // ----------------------------------------------------

  async createSessionForPasskeyUser(
    userId: string,
    devicePayload?: DeviceRegistrationPayload,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokensResponse> {
    let deviceRecord: DeviceRow | undefined;
    if (devicePayload) {
      deviceRecord = await this.deviceRepo.registerDevice(userId, devicePayload);
    }

    const refreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.configService.jwtRefreshExpirationSeconds * 1000);
    const sessionId = generateUuidV7();

    await this.sessionRepo.createSession({
      id: sessionId,
      userId,
      deviceId: deviceRecord?.id,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      lastActiveAt: new Date(),
    });

    const accessToken = this.tokenService.generateAccessToken({
      sub: userId,
      sid: sessionId,
      dev: deviceRecord?.id,
    });

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.AUTH_PASSKEY_LOGIN,
      userId,
      sessionId,
      deviceId: deviceRecord?.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      expiresIn: this.configService.jwtAccessExpirationSeconds,
      refreshToken,
      user: {
        id: userId,
        isNewUser: false,
      },
    };
  }

  // ----------------------------------------------------
  // Session Refresh with Rotation & Replay Detection
  // ----------------------------------------------------

  async refreshSession(
    refreshTokenRaw: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshTokenResponse> {
    if (!refreshTokenRaw || typeof refreshTokenRaw !== 'string') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Refresh token required',
      });
    }

    const tokenHash = this.tokenService.hashToken(refreshTokenRaw);

    // 1. Replay attack check: Has this token already been rotated?
    const rotatedHistory = await this.sessionRepo.findInTokenHistory(tokenHash);
    if (rotatedHistory) {
      // CRITICAL SECURITY ALERT: Rotated token reused!
      // Immediately revoke the compromised session
      await this.sessionRepo.revokeSession(rotatedHistory.sessionId, 'TOKEN_REPLAY_DETECTED');

      await this.securityService.recordSecurityEvent({
        eventType: AuthEventType.SESSION_REPLAY_DETECTED,
        severity: 'CRITICAL',
        sessionId: rotatedHistory.sessionId,
        ipAddress,
        userAgent,
        metadata: { tokenHash: '[REDACTED]' },
      });

      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_REPLAY_DETECTED,
        message: 'Refresh token replay detected. Session has been revoked for security.',
      });
    }

    // 2. Lookup active session
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!session) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid refresh token',
      });
    }

    if (session.revokedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_REVOKED,
        message: 'Session has been revoked',
      });
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_EXPIRED,
        message: 'Session refresh token has expired',
      });
    }

    // Security Hardening (Gate 16): Enforce account lifecycle on refresh
    const userRows = await this.databaseService.client
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const userStatus = userRows[0]?.status;
    if (userStatus === 'BANNED' || userStatus === 'DELETED') {
      await this.sessionRepo.revokeSession(session.id, 'ACCOUNT_BANNED');
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_BANNED,
        message: 'Your account has been permanently suspended or removed.',
      });
    }
    if (userStatus === 'SUSPENDED') {
      await this.sessionRepo.revokeSession(session.id, 'ACCOUNT_SUSPENDED');
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_SUSPENDED,
        message: 'Your account is temporarily suspended. Please contact support.',
      });
    }

    // 3. Rotate Refresh Token transactionally
    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newTokenHash = this.tokenService.hashToken(newRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + this.configService.jwtRefreshExpirationSeconds * 1000
    );

    await this.sessionRepo.rotateSessionToken(session.id, tokenHash, newTokenHash, newExpiresAt);

    // 4. Issue new access token
    const accessToken = this.tokenService.generateAccessToken({
      sub: session.userId,
      sid: session.id,
      dev: session.deviceId ?? undefined,
    });

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.SESSION_REFRESHED,
      userId: session.userId,
      sessionId: session.id,
      deviceId: session.deviceId ?? undefined,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      expiresIn: this.configService.jwtAccessExpirationSeconds,
      refreshToken: newRefreshToken,
    };
  }

  // ----------------------------------------------------
  // Logout Flows
  // ----------------------------------------------------

  async logout(sessionId: string, userId: string): Promise<LogoutResponse> {
    await this.sessionRepo.revokeSession(sessionId, 'USER_LOGOUT');

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.LOGOUT,
      userId,
      sessionId,
    });

    return { message: 'Successfully logged out.' };
  }

  async logoutAll(userId: string): Promise<LogoutResponse> {
    await this.sessionRepo.revokeAllUserSessions(userId, 'USER_LOGOUT_ALL');

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.LOGOUT_ALL,
      userId,
    });

    return { message: 'All active sessions have been revoked.' };
  }

  // ----------------------------------------------------
  // Session Management (Self-service with Ownership)
  // ----------------------------------------------------

  async listUserSessions(userId: string, currentSessionId: string): Promise<SessionItemResponse[]> {
    const activeSessions = await this.sessionRepo.listActiveUserSessions(userId);

    return activeSessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      platform: s.platform,
      deviceModel: s.deviceModel,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
      isCurrentSession: s.id === currentSessionId,
    }));
  }

  async revokeUserSession(userId: string, targetSessionId: string): Promise<RevokeSessionResponse> {
    const target = await this.sessionRepo.findById(targetSessionId);
    if (!target) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Session not found',
      });
    }

    // Object-level authorization enforcement
    if (target.userId !== userId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have permission to revoke this session',
      });
    }

    await this.sessionRepo.revokeSession(targetSessionId, 'USER_REVOCATION');

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.SESSION_REVOKED,
      userId,
      sessionId: targetSessionId,
    });

    return { message: 'Session revoked successfully.' };
  }

  // ----------------------------------------------------
  // Device Management (Self-service with Ownership)
  // ----------------------------------------------------

  async registerDevice(
    userId: string,
    payload: DeviceRegistrationPayload
  ): Promise<DeviceItemResponse> {
    const device = await this.deviceRepo.registerDevice(userId, payload);

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.DEVICE_REGISTERED,
      userId,
      deviceId: device.id,
    });

    return {
      id: device.id,
      userId: device.userId,
      platform: device.platform as ClientPlatform,
      deviceModel: device.deviceModel,
      appVersion: device.appVersion,
      pushToken: device.pushToken,
      lastActiveAt: device.lastActiveAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }

  async listUserDevices(userId: string): Promise<DeviceItemResponse[]> {
    const deviceRows = await this.deviceRepo.listByUserId(userId);

    return deviceRows.map((d) => ({
      id: d.id,
      userId: d.userId,
      platform: d.platform as ClientPlatform,
      deviceModel: d.deviceModel,
      appVersion: d.appVersion,
      pushToken: d.pushToken,
      lastActiveAt: d.lastActiveAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async revokeUserDevice(userId: string, deviceId: string): Promise<RevokeDeviceResponse> {
    const target = await this.deviceRepo.findById(deviceId);
    if (!target) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Device not found',
      });
    }

    if (target.userId !== userId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have permission to revoke this device',
      });
    }

    await this.deviceRepo.deleteDevice(deviceId, userId);

    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.DEVICE_REVOKED,
      userId,
      deviceId,
    });

    return { message: 'Device revoked successfully.' };
  }

  // ----------------------------------------------------
  // Self-Service Account Deletion (Store Compliance)
  // ----------------------------------------------------

  async deleteUserAccount(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string }> {
    const db = this.databaseService.client;
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];

    if (!user || user.status === 'DELETED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'User account not found or already deleted.',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      // 1. Mark user as DELETED with timestamp
      await tx
        .update(users)
        .set({
          status: 'DELETED',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 2. Hide profile from discovery and social feeds immediately
      await tx
        .update(profiles)
        .set({
          visibility: 'HIDDEN',
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, userId));

      // 3. Remove/revoke push notification device bindings
      await tx.delete(devices).where(eq(devices.userId, userId));
    });

    // 4. Revoke all active user sessions
    await this.sessionRepo.revokeAllUserSessions(userId, 'ACCOUNT_DELETED');

    // 5. Record security event for audit trail
    await this.securityService.recordSecurityEvent({
      eventType: AuthEventType.ACCOUNT_DELETED,
      userId,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message:
        'Account successfully scheduled for permanent deletion and all active sessions revoked.',
    };
  }

  // ----------------------------------------------------
  // Shared User & Session Resolution Invariant
  // ----------------------------------------------------

  private async resolveOrCreateUserAndSession(params: {
    provider: 'PHONE' | 'EMAIL' | 'GOOGLE' | 'APPLE' | 'FIREBASE';
    providerSubject: string;
    email?: string;
    emailVerified?: boolean;
    devicePayload?: DeviceRegistrationPayload;
    ipAddress?: string;
    userAgent?: string;
    eventOnSuccess: AuthEventType;
  }): Promise<AuthTokensResponse> {
    const result = await this.databaseService.withTransaction(async (tx) => {
      // 1. Check if identity exists
      let identity = await this.userIdentityRepo.findByProvider(
        params.provider,
        params.providerSubject,
        tx
      );

      let userId: string;
      let isNewUser = false;

      if (!identity) {
        // Create canonical user account
        userId = generateUuidV7();
        isNewUser = true;

        await tx.insert(users).values({
          id: userId,
          status: 'ACTIVE',
        });

        // Attach identity
        identity = await this.userIdentityRepo.create(
          {
            id: generateUuidV7(),
            userId,
            provider: params.provider,
            providerSubject: params.providerSubject,
            email: params.email,
            emailVerified: params.emailVerified ?? false,
            lastUsedAt: new Date(),
          },
          tx
        );
      } else {
        userId = identity.userId;
        await this.userIdentityRepo.updateLastUsed(identity.id, tx);

        // Security Hardening (Gate 16): Enforce user account status on login
        const userRows = await tx
          .select({ status: users.status })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const userStatus = userRows[0]?.status;
        if (userStatus === 'BANNED' || userStatus === 'DELETED') {
          throw new ForbiddenException({
            code: ErrorCode.ACCOUNT_BANNED,
            message: 'Your account has been permanently suspended or removed.',
          });
        }
        if (userStatus === 'SUSPENDED') {
          throw new ForbiddenException({
            code: ErrorCode.ACCOUNT_SUSPENDED,
            message: 'Your account is temporarily suspended. Please contact support.',
          });
        }
      }

      // 2. Register/update device if provided
      let deviceRecord: DeviceRow | undefined;
      if (params.devicePayload) {
        deviceRecord = await this.deviceRepo.registerDevice(userId, params.devicePayload, tx);
      }

      // 3. Create Session with rotating refresh token
      const sessionId = generateUuidV7();
      const refreshToken = this.tokenService.generateRefreshToken();
      const tokenHash = this.tokenService.hashToken(refreshToken);
      const expiresAt = new Date(
        Date.now() + this.configService.jwtRefreshExpirationSeconds * 1000
      );

      await this.sessionRepo.createSession(
        {
          id: sessionId,
          userId,
          deviceId: deviceRecord?.id,
          tokenHash,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          expiresAt,
          lastActiveAt: new Date(),
        },
        tx
      );

      // 4. Issue access token
      const accessToken = this.tokenService.generateAccessToken({
        sub: userId,
        sid: sessionId,
        dev: deviceRecord?.id,
      });

      return {
        accessToken,
        expiresIn: this.configService.jwtAccessExpirationSeconds,
        refreshToken,
        user: {
          id: userId,
          isNewUser,
        },
        sessionId,
        deviceId: deviceRecord?.id,
      };
    });

    // 5. Telemetry (executed after transaction commit so foreign keys are durable)
    await this.securityService.recordSecurityEvent({
      eventType: params.eventOnSuccess,
      userId: result.user.id,
      sessionId: result.sessionId,
      deviceId: result.deviceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { isNewUser: result.user.isNewUser, provider: params.provider },
    });

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }
}
