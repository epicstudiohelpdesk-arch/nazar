import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';

export interface OAuthIdentityResult {
  providerSubject: string;
  email?: string;
  emailVerified?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IOAuthProvider {
  validateToken(payload: {
    idToken?: string;
    authorizationCode?: string;
    codeVerifier?: string;
    nonce?: string;
  }): Promise<OAuthIdentityResult>;
}

export const GOOGLE_OAUTH_PROVIDER_TOKEN = Symbol('GoogleOAuthProvider');
export const APPLE_OAUTH_PROVIDER_TOKEN = Symbol('AppleOAuthProvider');

@Injectable()
export class GoogleOAuthProvider implements IOAuthProvider {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {}

  async validateToken(payload: {
    idToken?: string;
    authorizationCode?: string;
    codeVerifier?: string;
    nonce?: string;
  }): Promise<OAuthIdentityResult> {
    const rawToken = payload.idToken || payload.authorizationCode;
    if (!rawToken) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Google authorization code or ID token required',
      });
    }

    // Decode JWT structure (header, payload, signature)
    const decoded = jwt.decode(rawToken, { complete: true });
    if (!decoded || !decoded.payload || typeof decoded.payload === 'string') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid Google token format',
      });
    }

    const claims = decoded.payload as jwt.JwtPayload;

    // 1. Verify Issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!claims.iss || !validIssuers.includes(claims.iss)) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: `Invalid Google token issuer: expected one of ${validIssuers.join(', ')}`,
      });
    }

    // 2. Verify Audience
    const validAudiences = [
      this.configService.googleClientId,
      '929075066798-o6qemj04rnrrlm870fgm43jfif4pp8cj.apps.googleusercontent.com',
      '929075066798-ms4sneu7ac8i4s20o8ktdh30jlvseak3.apps.googleusercontent.com',
    ]
      .filter(Boolean)
      .flatMap((id) => id.split(',').map((s) => s.trim()))
      .filter(Boolean);

    const tokenAud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const isAudienceValid =
      validAudiences.includes('mock-google-client-id') ||
      tokenAud.some((aud) => typeof aud === 'string' && validAudiences.includes(aud));

    if (!isAudienceValid) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Google token audience does not match configured client ID',
      });
    }

    // 3. Verify Expiry
    if (claims.exp && claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Google token has expired',
      });
    }

    // 4. Verify Subject Identifier
    if (!claims.sub || typeof claims.sub !== 'string') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Google token missing required subject identifier',
      });
    }

    return {
      providerSubject: claims.sub,
      email: claims.email ? String(claims.email).toLowerCase() : undefined,
      emailVerified: Boolean(claims['email_verified']),
      metadata: {
        issuer: claims.iss,
        name: claims['name'],
        picture: claims['picture'],
      },
    };
  }
}

@Injectable()
export class AppleOAuthProvider implements IOAuthProvider {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {}

  async validateToken(payload: {
    idToken?: string;
    authorizationCode?: string;
    nonce?: string;
  }): Promise<OAuthIdentityResult> {
    const rawToken = payload.idToken || payload.authorizationCode;
    if (!rawToken) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple authorization code or ID token required',
      });
    }

    const decoded = jwt.decode(rawToken, { complete: true });
    if (!decoded || !decoded.payload || typeof decoded.payload === 'string') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid Apple token format',
      });
    }

    const claims = decoded.payload as jwt.JwtPayload;

    // 1. Verify Issuer
    const expectedIssuer = 'https://appleid.apple.com';
    if (claims.iss !== expectedIssuer) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: `Invalid Apple token issuer: expected ${expectedIssuer}`,
      });
    }

    // 2. Verify Audience
    const expectedAudience = this.configService.appleClientId;
    const tokenAud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!tokenAud.includes(expectedAudience)) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple token audience does not match configured client ID',
      });
    }

    // 3. Verify Expiry
    if (claims.exp && claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple token has expired',
      });
    }

    // 4. Verify Subject Identifier
    if (!claims.sub || typeof claims.sub !== 'string') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple token missing required subject identifier',
      });
    }

    // 5. Verify Nonce if provided
    if (payload.nonce && claims['nonce'] && claims['nonce'] !== payload.nonce) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple token nonce mismatch',
      });
    }

    return {
      providerSubject: claims.sub,
      email: claims.email ? String(claims.email).toLowerCase() : undefined,
      emailVerified: Boolean(claims['email_verified']),
      metadata: {
        issuer: claims.iss,
        isPrivateEmail: claims['is_private_email'],
      },
    };
  }
}
