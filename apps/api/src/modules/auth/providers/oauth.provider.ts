import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import * as jose from 'jose';
import crypto from 'node:crypto';
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
    redirectUri?: string;
    nonce?: string;
  }): Promise<OAuthIdentityResult>;
}

export const GOOGLE_OAUTH_PROVIDER_TOKEN = Symbol('GoogleOAuthProvider');
export const APPLE_OAUTH_PROVIDER_TOKEN = Symbol('AppleOAuthProvider');

/**
 * Gate 1B — cryptographic identity verification.
 *
 * The provider previously only DECODED the incoming JWT and trusted its
 * claims (full account takeover with a self-signed token). It now:
 *   1. verifies the signature against the provider's published JWKS;
 *   2. pins the algorithm to an explicit allowlist;
 *   3. validates issuer, audience, expiry and (Apple) nonce;
 *   4. exchanges authorization codes server-side at the provider token
 *      endpoint (PKCE) so the client can never assert its own claims;
 *   5. fails CLOSED on any key-service or token-endpoint failure.
 */

/** Algorithms accepted for Google ID tokens (RS256 + ES256, as published). */
const GOOGLE_ALLOWED_ALGORITHMS = ['RS256', 'ES256'] as const;
/** Apple identity tokens are signed with ES256. */
const APPLE_ALLOWED_ALGORITHMS = ['ES256'] as const;

/** Server-side logger for verification failures (no token material). */
const verificationFailureLogger = new Logger('OAuthVerification');

type JwksKeyResolver = jose.RemoteJWKSet;

interface CachedJwks {
  resolver: JwksKeyResolver;
  url: string;
}

/**
 * Caches one remote JWKS resolver per provider URL. `jose` handles key
 * caching, refresh on unknown `kid`, and cooldown after repeated failures.
 */
@Injectable()
export class JwksKeyService {
  private readonly logger = new Logger(JwksKeyService.name);
  private readonly cache = new Map<string, CachedJwks>();

  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {}

  resolverFor(url: string): JwksKeyResolver {
    const cached = this.cache.get(url);
    if (cached) {
      return cached.resolver;
    }
    const resolver = jose.createRemoteJWKSet(new URL(url), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000,
      timeoutDuration: 5_000,
    });
    this.cache.set(url, { resolver, url });
    this.logger.log('[JwksKeyService] Initialized remote JWKS resolver for configured endpoint');
    return resolver;
  }

  get googleResolver(): JwksKeyResolver {
    return this.resolverFor(this.configService.googleJwksUrl);
  }

  get appleResolver(): JwksKeyResolver {
    return this.resolverFor(this.configService.appleJwksUrl);
  }
}

/**
 * Shared claim validation used by both providers. Every failure path throws
 * UnauthorizedException with a generic message (no token material, no claims
 * echo) so that errors never disclose provider internals.
 */
async function verifyIdentityToken(options: {
  idToken: string;
  resolver: JwksKeyResolver;
  allowedAlgorithms: readonly string[];
  allowedIssuers: readonly string[];
  allowedAudiences: readonly string[];
  expectedNonce?: string;
  /** Apple returns the SHA-256 hash of the client nonce, not the raw value. */
  nonceFormat?: 'raw' | 'apple';
}): Promise<jose.JWTPayload & { sub: string }> {
  const {
    idToken,
    resolver,
    allowedAlgorithms,
    allowedIssuers,
    allowedAudiences,
    expectedNonce,
    nonceFormat = 'raw',
  } = options;

  if (!idToken || idToken.length > 8192) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity token is missing or malformed',
    });
  }

  if (allowedAudiences.length === 0 || allowedIssuers.length === 0) {
    verificationFailureLogger.error(
      'OAuth identity provider is not configured (missing audience/issuer allowlist)'
    );
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity provider is not configured',
    });
  }

  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(idToken, resolver, {
      algorithms: [...allowedAlgorithms],
      issuer: [...allowedIssuers],
      audience: [...allowedAudiences],
      clockTolerance: 5,
      maxTokenAge: '10 minutes',
    });
    payload = result.payload;
  } catch (err: unknown) {
    // Fail closed. The underlying error is intentionally not surfaced to the
    // client; it is logged server-side without token material.
    const reason = err instanceof Error ? err.name : 'unknown';
    verificationFailureLogger.warn(`OAuth identity token verification failed (reason=${reason})`);
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity token verification failed',
    });
  }

  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity token verification failed',
    });
  }

  // OIDC: when an authorized party is present it must be one of the client IDs
  // we accept. This prevents a token minted for an unrelated client with an
  // overlapping audience from being accepted.
  if (payload.azp !== undefined) {
    if (typeof payload.azp !== 'string' || !allowedAudiences.includes(payload.azp)) {
      verificationFailureLogger.warn('OAuth identity token rejected: azp is not an allowed client');
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Identity token verification failed',
      });
    }
  }

  if (expectedNonce) {
    const claimNonce = payload.nonce;
    const expectedHashedNonce = crypto
      .createHash('sha256')
      .update(expectedNonce, 'utf8')
      .digest('hex');

    const nonceMatches =
      typeof claimNonce === 'string' &&
      (claimNonce === expectedNonce ||
        (nonceFormat === 'apple' && claimNonce.toLowerCase() === expectedHashedNonce));

    if (!nonceMatches) {
      verificationFailureLogger.warn('OAuth identity token rejected: nonce mismatch');
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Identity token verification failed',
      });
    }
  }

  // Narrow the subject type for callers (validated above).
  const subject: string = payload.sub;

  return { ...payload, sub: subject } as jose.JWTPayload & { sub: string };
}

/** Validates a redirect target against the explicit allowlist. */
function assertRedirectAllowed(redirectUri: string | undefined, allowlist: string[]): void {
  // Authorization-code exchange always requires the redirect that was used in
  // the authorization request, and it must match an explicitly configured
  // target exactly (no prefix/wildcard matching).
  if (!redirectUri || allowlist.length === 0 || !allowlist.includes(redirectUri)) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'OAuth redirect target is not permitted',
    });
  }
}

/**
 * Builds a short-lived Apple client secret (ES256 JWT) from the configured
 * Sign in with Apple key. Static `APPLE_OAUTH_CLIENT_SECRET` takes precedence.
 */
async function resolveAppleClientSecret(config: AppConfigService): Promise<string> {
  const staticSecret = config.appleOAuthClientSecret;
  if (staticSecret) {
    return staticSecret;
  }

  const teamId = config.appleSignInTeamId;
  const keyId = config.appleSignInKeyId;
  const privateKey = config.appleSignInPrivateKey;
  const clientId = config.appleClientIds[0];

  if (!teamId || !keyId || !privateKey || !clientId) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity provider is unavailable',
    });
  }

  const key = await jose.importPKCS8(privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(key);
}

/** Performs a server-side PKCE authorization-code exchange. */
async function exchangeAuthorizationCode(options: {
  provider: 'google' | 'apple';
  tokenUrl: string;
  code: string;
  codeVerifier?: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
}): Promise<Record<string, unknown>> {
  const { provider, tokenUrl, code, codeVerifier, redirectUri, clientId, clientSecret } = options;

  // Google and Apple authorization codes are short-lived opaque values. Reject
  // obviously malformed input before making an outbound request.
  if (!code || code.length > 4096) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'OAuth authorization code is invalid',
    });
  }
  if (codeVerifier !== undefined && (codeVerifier.length < 43 || codeVerifier.length > 128)) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'OAuth code verifier is invalid',
    });
  }
  // Public mobile clients must prove possession of the PKCE verifier. Clients
  // configured with a confidential secret may omit it.
  if (!clientSecret && !codeVerifier) {
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'OAuth code verifier is required',
    });
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.name : 'unknown';
    verificationFailureLogger.warn(
      `OAuth token endpoint request failed (provider=${provider}, reason=${reason})`
    );
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity provider is unavailable',
    });
  }

  if (!response.ok) {
    // Never log the provider response body: it may echo request parameters.
    verificationFailureLogger.warn(
      `OAuth token endpoint rejected the exchange (provider=${provider}, status=${response.status})`
    );
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity provider is unavailable',
    });
  }

  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    verificationFailureLogger.warn(
      `OAuth token endpoint returned malformed JSON (provider=${provider})`
    );
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity provider returned an invalid response',
    });
  }

  if (typeof json['id_token'] !== 'string' || json['id_token'].length === 0) {
    verificationFailureLogger.warn(
      `OAuth token endpoint returned no identity token (provider=${provider})`
    );
    throw new UnauthorizedException({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Identity provider did not return a verifiable identity token',
    });
  }

  return json;
}

@Injectable()
export class GoogleOAuthProvider implements IOAuthProvider {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(JwksKeyService)
    private readonly jwks: JwksKeyService
  ) {}

  async validateToken(payload: {
    idToken?: string;
    authorizationCode?: string;
    codeVerifier?: string;
    redirectUri?: string;
    nonce?: string;
  }): Promise<OAuthIdentityResult> {
    const clientIds = this.configService.googleClientIds;
    if (clientIds.length === 0) {
      verificationFailureLogger.error('Google OAuth is not configured (no audience allowlist)');
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Google sign-in is not configured',
      });
    }
    const allowlist = this.configService.oauthRedirectAllowlist;

    let idToken = payload.idToken;

    if (!idToken && payload.authorizationCode) {
      assertRedirectAllowed(payload.redirectUri, allowlist);
      const exchange = await exchangeAuthorizationCode({
        provider: 'google',
        tokenUrl: this.configService.googleTokenUrl,
        code: payload.authorizationCode,
        codeVerifier: payload.codeVerifier,
        redirectUri: payload.redirectUri!,
        clientId: clientIds[0]!,
        clientSecret: this.configService.googleOAuthClientSecret,
      });
      idToken = exchange['id_token'] as string;
    }

    if (!idToken) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Google authorization code or ID token required',
      });
    }

    const claims = await verifyIdentityToken({
      idToken,
      resolver: this.jwks.googleResolver,
      allowedAlgorithms: GOOGLE_ALLOWED_ALGORITHMS,
      allowedIssuers: this.configService.googleIssuers,
      allowedAudiences: clientIds,
      expectedNonce: payload.nonce,
      nonceFormat: 'raw',
    });

    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : undefined;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

    return {
      providerSubject: claims.sub,
      email,
      emailVerified,
      metadata: {
        issuer: typeof claims.iss === 'string' ? claims.iss : undefined,
        name: typeof claims.name === 'string' ? claims.name : undefined,
        picture: typeof claims.picture === 'string' ? claims.picture : undefined,
      },
    };
  }
}

@Injectable()
export class AppleOAuthProvider implements IOAuthProvider {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(JwksKeyService)
    private readonly jwks: JwksKeyService
  ) {}

  async validateToken(payload: {
    idToken?: string;
    authorizationCode?: string;
    codeVerifier?: string;
    redirectUri?: string;
    nonce?: string;
  }): Promise<OAuthIdentityResult> {
    const clientIds = this.configService.appleClientIds;
    if (clientIds.length === 0) {
      verificationFailureLogger.error('Apple OAuth is not configured (no audience allowlist)');
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple sign-in is not configured',
      });
    }
    const allowlist = this.configService.oauthRedirectAllowlist;

    let idToken = payload.idToken;

    if (!idToken && payload.authorizationCode) {
      assertRedirectAllowed(payload.redirectUri, allowlist);
      const clientSecret = await resolveAppleClientSecret(this.configService);
      const exchange = await exchangeAuthorizationCode({
        provider: 'apple',
        tokenUrl: this.configService.appleTokenUrl,
        code: payload.authorizationCode,
        codeVerifier: payload.codeVerifier,
        redirectUri: payload.redirectUri!,
        clientId: clientIds[0]!,
        clientSecret,
      });
      idToken = exchange['id_token'] as string;
    }

    if (!idToken) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Apple authorization code or ID token required',
      });
    }

    const claims = await verifyIdentityToken({
      idToken,
      resolver: this.jwks.appleResolver,
      allowedAlgorithms: APPLE_ALLOWED_ALGORITHMS,
      allowedIssuers: this.configService.appleIssuers,
      allowedAudiences: clientIds,
      expectedNonce: payload.nonce,
      nonceFormat: 'apple',
    });

    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : undefined;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

    return {
      providerSubject: claims.sub,
      email,
      emailVerified,
      metadata: {
        issuer: typeof claims.iss === 'string' ? claims.iss : undefined,
        isPrivateEmail: claims.is_private_email,
      },
    };
  }
}
