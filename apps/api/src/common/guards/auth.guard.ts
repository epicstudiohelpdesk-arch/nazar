import {
  Injectable,
  Inject,
  Optional,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@platform/api-contracts';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import {
  TOKEN_SERVICE_TOKEN,
  type ITokenService,
} from '../../modules/auth/tokens/token.interface.js';
import {
  SESSION_REPOSITORY_TOKEN,
  type ISessionRepository,
} from '../../modules/auth/repositories/session.repository.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../modules/safety/repositories/user-restrictions.repository.interface.js';
import {
  USER_REPOSITORY_TOKEN,
  type IUserRepository,
} from '../../infrastructure/database/repositories/user.repository.js';

export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly deviceId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    @Optional()
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo?: IUserRestrictionsRepository,
    @Optional()
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepo?: IUserRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const url = request.originalUrl || request.url || '';
    if (url.startsWith('/v1/admin')) {
      // Administrative endpoints use dedicated AdminAuthGuard and staff identities
      return true;
    }

    const authHeader = request.headers['authorization'];

    if (isPublic) {
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token) {
          try {
            const payload = this.tokenService.verifyAccessToken(token);
            const session = await this.sessionRepository.findById(payload.sid);
            if (session && !session.revokedAt && session.expiresAt >= new Date()) {
              request.user = {
                userId: payload.sub,
                sessionId: payload.sid,
                deviceId: payload.dev,
              };
            }
          } catch {
            // Optional auth ignores invalid token on public routes
          }
        }
      }
      return true;
    }

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Missing or malformed Authorization header. Bearer token required.',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Bearer token cannot be empty',
      });
    }

    // 1. Cryptographic and claim validation
    const payload = this.tokenService.verifyAccessToken(token);

    // 2. Durable session state verification
    const session = await this.sessionRepository.findById(payload.sid);
    if (!session) {
      throw new UnauthorizedException({
        code: ErrorCode.SESSION_EXPIRED,
        message: 'Session does not exist',
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
        message: 'Session refresh lifecycle has expired',
      });
    }

    // 3. Verify user active restrictions (Requirements 15, 16, 17)
    if (this.userRestrictionsRepo) {
      const isFullBanned = await this.userRestrictionsRepo.hasActiveRestriction(
        payload.sub,
        'FULL_ACCOUNT'
      );
      if (isFullBanned) {
        throw new ForbiddenException({
          code: ErrorCode.ACCOUNT_BANNED,
          message: 'Account has been permanently suspended or banned',
        });
      }

      const isLoginSuspended = await this.userRestrictionsRepo.hasActiveRestriction(
        payload.sub,
        'ACCOUNT_LOGIN'
      );
      if (isLoginSuspended) {
        throw new ForbiddenException({
          code: ErrorCode.ACCOUNT_SUSPENDED,
          message: 'Account login is temporarily suspended',
        });
      }
    }

    // 3.5. Security Hardening (Gate 16): Verify database account status
    if (this.userRepo) {
      const user = await this.userRepo.findById(payload.sub);
      if (!user || user.status === 'DELETED') {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Account no longer exists',
        });
      }
      if (user.status === 'BANNED') {
        throw new ForbiddenException({
          code: ErrorCode.ACCOUNT_BANNED,
          message: 'Account has been permanently banned',
        });
      }
      if (user.status === 'SUSPENDED') {
        throw new ForbiddenException({
          code: ErrorCode.ACCOUNT_SUSPENDED,
          message: 'Account is temporarily suspended',
        });
      }
    }

    // 4. Attach authenticated principal
    const principal: AuthenticatedPrincipal = {
      userId: payload.sub,
      sessionId: payload.sid,
      deviceId: payload.dev,
    };

    request.user = principal;
    return true;
  }
}
