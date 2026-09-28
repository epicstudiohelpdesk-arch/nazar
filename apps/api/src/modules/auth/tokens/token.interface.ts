export interface AccessTokenPayload {
  readonly sub: string; // User ID
  readonly sid: string; // Session ID
  readonly dev?: string; // Device ID
  readonly iat?: number;
  readonly exp?: number;
  readonly iss?: string;
  readonly aud?: string;
}

export interface ITokenService {
  generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  generateRefreshToken(): string;
  hashToken(token: string): string;
  generateOtp(length?: number): string;
  generateSalt(): string;
  hashSecret(secret: string, salt: string): string;
  verifySecret(secret: string, salt: string, expectedHash: string): boolean;
}

export const TOKEN_SERVICE_TOKEN = Symbol('ITokenService');
