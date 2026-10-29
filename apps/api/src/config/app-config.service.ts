import { Injectable } from '@nestjs/common';
import { loadServerConfig, type ServerEnv } from '@platform/config';

@Injectable()
export class AppConfigService {
  private readonly env: ServerEnv;

  constructor() {
    this.env = loadServerConfig();
  }

  get config(): ServerEnv {
    return this.env;
  }

  get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get port(): number {
    return this.env.PORT;
  }

  get apiPrefix(): string {
    return this.env.API_PREFIX;
  }

  get corsOrigin(): string {
    return this.env.CORS_ORIGIN;
  }

  get logLevel(): string {
    return this.env.LOG_LEVEL;
  }

  get appName(): string {
    return this.env.APP_NAME;
  }

  get appVersion(): string {
    return this.env.APP_VERSION;
  }

  get rateLimitTtlMs(): number {
    return this.env.RATE_LIMIT_TTL_MS;
  }

  get rateLimitLimit(): number {
    return this.env.RATE_LIMIT_LIMIT;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get databasePoolMin(): number {
    return this.env.DATABASE_POOL_MIN;
  }

  get databasePoolMax(): number {
    return this.env.DATABASE_POOL_MAX;
  }

  get databaseConnectionTimeoutMs(): number {
    return this.env.DATABASE_CONNECTION_TIMEOUT_MS;
  }

  get databaseIdleTimeoutMs(): number {
    return this.env.DATABASE_IDLE_TIMEOUT_MS;
  }

  get databaseStatementTimeoutMs(): number {
    return this.env.DATABASE_STATEMENT_TIMEOUT_MS;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
  }

  get fieldEncryptionKey(): string {
    return this.env.FIELD_ENCRYPTION_KEY;
  }

  get jwtAccessExpirationSeconds(): number {
    return this.env.JWT_ACCESS_EXPIRATION_SECONDS;
  }

  get jwtRefreshExpirationSeconds(): number {
    return this.env.JWT_REFRESH_EXPIRATION_SECONDS;
  }

  get jwtIssuer(): string {
    return this.env.JWT_ISSUER;
  }

  get jwtAudience(): string {
    return this.env.JWT_AUDIENCE;
  }

  get otpExpirationSeconds(): number {
    return this.env.OTP_EXPIRATION_SECONDS;
  }

  get otpMaxAttempts(): number {
    return this.env.OTP_MAX_ATTEMPTS;
  }

  get otpLength(): number {
    return this.env.OTP_LENGTH;
  }

  get emailVerificationExpirationSeconds(): number {
    return this.env.EMAIL_VERIFICATION_EXPIRATION_SECONDS;
  }

  // Gate 1B: prefer the allowlist accessors below; these remain for legacy
  // call sites but return the first configured value (or '').
  get googleClientId(): string {
    return this.googleClientIds[0] ?? '';
  }

  get appleClientId(): string {
    return this.appleClientIds[0] ?? '';
  }

  get googleOAuthClientSecret(): string | undefined {
    return this.env.GOOGLE_OAUTH_CLIENT_SECRET;
  }

  get appleOAuthClientSecret(): string | undefined {
    return this.env.APPLE_OAUTH_CLIENT_SECRET;
  }

  get appleSignInTeamId(): string | undefined {
    return this.env.APPLE_SIGN_IN_TEAM_ID;
  }

  get appleSignInKeyId(): string | undefined {
    return this.env.APPLE_SIGN_IN_KEY_ID;
  }

  get appleSignInPrivateKey(): string | undefined {
    return this.env.APPLE_SIGN_IN_PRIVATE_KEY;
  }

  get passkeyRpId(): string {
    return this.env.PASSKEY_RP_ID;
  }

  get passkeyRpName(): string {
    return this.env.PASSKEY_RP_NAME;
  }

  get passkeyOrigin(): string {
    return this.env.PASSKEY_ORIGIN;
  }

  get s3Endpoint(): string {
    return this.env.S3_ENDPOINT;
  }

  get s3Region(): string {
    return this.env.S3_REGION;
  }

  get s3BucketName(): string {
    return this.env.S3_BUCKET_NAME;
  }

  get s3AccessKeyId(): string {
    return this.env.S3_ACCESS_KEY_ID;
  }

  get s3SecretAccessKey(): string {
    return this.env.S3_SECRET_ACCESS_KEY;
  }

  get s3ForcePathStyle(): boolean {
    return this.env.S3_FORCE_PATH_STYLE;
  }

  get mediaPublicUrlPrefix(): string {
    return this.env.MEDIA_PUBLIC_URL_PREFIX;
  }

  get mediaUploadExpirySeconds(): number {
    return this.env.MEDIA_UPLOAD_EXPIRY_SECONDS;
  }

  get mediaMaxBytes(): number {
    return this.env.MEDIA_MAX_BYTES;
  }

  get mediaMaxPhotos(): number {
    return this.env.MEDIA_MAX_PHOTOS;
  }

  get mediaMinPhotos(): number {
    return this.env.MEDIA_MIN_PHOTOS;
  }

  get apnsTeamId(): string | undefined {
    return this.env.APNS_TEAM_ID;
  }

  get apnsKeyId(): string | undefined {
    return this.env.APNS_KEY_ID;
  }

  get apnsPrivateKey(): string | undefined {
    return this.env.APNS_PRIVATE_KEY;
  }

  get apnsBundleId(): string {
    return this.env.APNS_BUNDLE_ID;
  }

  get apnsProduction(): boolean {
    return this.env.APNS_PRODUCTION;
  }

  get fcmProjectId(): string | undefined {
    return this.env.FCM_PROJECT_ID;
  }

  get fcmClientEmail(): string | undefined {
    return this.env.FCM_CLIENT_EMAIL;
  }

  get fcmPrivateKey(): string | undefined {
    return this.env.FCM_PRIVATE_KEY;
  }

  get pushProviderMock(): boolean {
    return this.env.PUSH_PROVIDER_MOCK;
  }

  get appleBillingEnvironment(): 'sandbox' | 'production' {
    return this.env.APPLE_BILLING_ENVIRONMENT;
  }

  get appleIssuerId(): string | undefined {
    return this.env.APPLE_ISSUER_ID;
  }

  get appleKeyId(): string | undefined {
    return this.env.APPLE_KEY_ID;
  }

  get appleBundleId(): string {
    return this.env.APPLE_BUNDLE_ID;
  }

  get applePrivateKey(): string | undefined {
    return this.env.APPLE_PRIVATE_KEY;
  }

  get googlePlayPackageName(): string {
    return this.env.GOOGLE_PLAY_PACKAGE_NAME;
  }

  get googleServiceAccountJson(): string | undefined {
    return this.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }

  get billingProviderMock(): boolean {
    return this.env.BILLING_PROVIDER_MOCK;
  }

  /**
   * Gate 1A: when false (default), Apple/Google purchase & webhook processing
   * that lacks cryptographic verification is rejected fail-closed. The schema
   * forbids enabling this outside development/test environments.
   */
  get billingAllowUnverifiedProviders(): boolean {
    return this.env.BILLING_ALLOW_UNVERIFIED_PROVIDERS;
  }

  /**
   * Gate 1A: one-time enrollment secret for administrator provisioning.
   * Required (and operator-supplied) in staging/production; optional locally.
   */
  get adminProvisioningToken(): string | undefined {
    return this.env.ADMIN_PROVISIONING_TOKEN;
  }

  /**
   * Gate 1A: MFA policy for privileged administrators.
   * Defaults to enforced in staging/production when the variable is unset.
   */
  get adminMfaRequired(): boolean {
    if (this.env.ADMIN_MFA_REQUIRED !== undefined) {
      return this.env.ADMIN_MFA_REQUIRED;
    }
    return this.nodeEnv === 'staging' || this.nodeEnv === 'production';
  }

  /**
   * Gate 1A: identity-federation kill switches. Disabled by default because
   * these providers currently lack cryptographic verification (Gate 1B).
   */
  get authGoogleOAuthEnabled(): boolean {
    return this.env.AUTH_GOOGLE_OAUTH_ENABLED;
  }

  get authAppleOAuthEnabled(): boolean {
    return this.env.AUTH_APPLE_OAUTH_ENABLED;
  }

  get authPasskeyEnabled(): boolean {
    return this.env.AUTH_PASSKEY_ENABLED;
  }

  // ----------------------------------------------------
  // Gate 1B: Identity provider verification configuration
  // ----------------------------------------------------

  get googleJwksUrl(): string {
    return this.env.GOOGLE_JWKS_URL;
  }

  get googleTokenUrl(): string {
    return this.env.GOOGLE_TOKEN_URL;
  }

  get appleJwksUrl(): string {
    return this.env.APPLE_JWKS_URL;
  }

  get appleTokenUrl(): string {
    return this.env.APPLE_TOKEN_URL;
  }

  get googleIssuers(): string[] {
    return this.env.GOOGLE_ISSUERS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get appleIssuers(): string[] {
    return this.env.APPLE_ISSUERS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Configured OAuth client IDs (comma separated allowlist). */
  get googleClientIds(): string[] {
    return this.env.GOOGLE_CLIENT_ID.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get appleClientIds(): string[] {
    return this.env.APPLE_CLIENT_ID.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Exact-match allowlist of permitted OAuth redirect targets. */
  get oauthRedirectAllowlist(): string[] {
    return this.env.OAUTH_REDIRECT_ALLOWLIST.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get passkeyAllowedOrigins(): string[] {
    const origins = [this.env.PASSKEY_ORIGIN, ...this.env.PASSKEY_ALLOWED_ORIGINS.split(',')]
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(origins));
  }

  get passkeyUserVerification(): 'required' | 'preferred' | 'discouraged' {
    return this.env.PASSKEY_USER_VERIFICATION;
  }

  get passkeyAttestation(): 'none' | 'indirect' | 'direct' {
    return this.env.PASSKEY_ATTESTATION;
  }

  get passkeyResidentKey(): 'required' | 'preferred' | 'discouraged' {
    return this.env.PASSKEY_RESIDENT_KEY;
  }

  get passkeyChallengeTtlSeconds(): number {
    return this.env.PASSKEY_CHALLENGE_TTL_SECONDS;
  }

  get firebaseProjectId(): string {
    return this.env.FIREBASE_PROJECT_ID;
  }

  get firebaseServiceAccountPath(): string | undefined {
    return this.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  }

  get firebaseServiceAccountJson(): string | undefined {
    return this.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }
}
