import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';
import type { ITokenService, AccessTokenPayload } from './token.interface.js';

@Injectable()
export class TokenService implements ITokenService {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {}

  generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    const claims = {
      sub: payload.sub,
      sid: payload.sid,
      ...(payload.dev ? { dev: payload.dev } : {}),
    };

    return jwt.sign(claims, this.configService.jwtAccessSecret, {
      algorithm: 'HS256',
      expiresIn: this.configService.jwtAccessExpirationSeconds,
      issuer: this.configService.jwtIssuer,
      audience: this.configService.jwtAudience,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.configService.jwtAccessSecret, {
        algorithms: ['HS256'],
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      }) as jwt.JwtPayload;

      if (!decoded.sub || !decoded['sid']) {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Access token missing required security claims',
        });
      }

      return {
        sub: decoded.sub,
        sid: decoded['sid'] as string,
        dev: (decoded['dev'] as string) || undefined,
        iat: decoded.iat,
        exp: decoded.exp,
        iss: decoded.iss,
        aud: typeof decoded.aud === 'string' ? decoded.aud : decoded.aud?.[0],
      };
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException({
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Access token has expired',
        });
      }

      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Invalid access token signature or payload',
        });
      }

      throw err;
    }
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateOtp(length = this.configService.otpLength): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }

  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  hashSecret(secret: string, salt: string): string {
    return crypto.createHash('sha256').update(`${salt}:${secret}`).digest('hex');
  }

  verifySecret(secret: string, salt: string, expectedHash: string): boolean {
    const computedHash = this.hashSecret(secret, salt);
    const computedBuf = Buffer.from(computedHash, 'utf8');
    const expectedBuf = Buffer.from(expectedHash, 'utf8');

    if (computedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, expectedBuf);
  }
}
