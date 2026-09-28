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

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
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

  get googleClientId(): string {
    return this.env.GOOGLE_CLIENT_ID;
  }

  get appleClientId(): string {
    return this.env.APPLE_CLIENT_ID;
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
}
