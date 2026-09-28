import {
  Injectable,
  Inject,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
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
    private readonly sessionRepository: ISessionRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

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

    // 3. Attach authenticated principal
    const principal: AuthenticatedPrincipal = {
      userId: payload.sub,
      sessionId: payload.sid,
      deviceId: payload.dev,
    };

    request.user = principal;
    return true;
  }
}
