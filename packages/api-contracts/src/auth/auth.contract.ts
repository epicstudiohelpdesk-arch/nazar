/**
 * Authentication and Session API Contracts
 * Canonical interfaces for mobile, web, and internal API consumers.
 */

export type ClientPlatform = 'ios' | 'android' | 'web';

export interface DeviceRegistrationPayload {
  readonly platform: ClientPlatform;
  readonly deviceModel?: string;
  readonly appVersion?: string;
  readonly pushToken?: string;
}

export interface AuthenticatedUserSummary {
  readonly id: string;
  readonly isNewUser: boolean;
}

export interface AuthTokensResponse {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly user: AuthenticatedUserSummary;
}

export interface GenericAuthNoticeResponse {
  readonly message: string;
}

// ----------------------------------------------------
// Identifier Existence Check (Anti-Enumeration Guarded)
// ----------------------------------------------------

export interface CheckIdentifierPayload {
  readonly identifier: string;
  readonly type?: 'PHONE' | 'EMAIL';
}

export interface CheckIdentifierResponse {
  readonly exists: boolean;
  readonly provider?: 'PHONE' | 'EMAIL' | 'GOOGLE' | 'APPLE' | 'PASSKEY';
}

// ----------------------------------------------------
// Phone OTP Contracts
// ----------------------------------------------------

export interface RequestOtpPayload {
  readonly phoneNumber: string;
  readonly deviceId?: string;
}

export interface VerifyOtpPayload {
  readonly phoneNumber: string;
  readonly code: string;
  readonly device?: DeviceRegistrationPayload;
}

// ----------------------------------------------------
// Email Verification Contracts
// ----------------------------------------------------

export interface RequestEmailVerificationPayload {
  readonly email: string;
}

export interface VerifyEmailPayload {
  readonly email: string;
  readonly code: string;
  readonly device?: DeviceRegistrationPayload;
}

// ----------------------------------------------------
// OAuth / OIDC Contracts
// ----------------------------------------------------

export interface GoogleAuthPayload {
  readonly idToken?: string;
  readonly authorizationCode?: string;
  readonly codeVerifier?: string;
  readonly device?: DeviceRegistrationPayload;
}

export interface AppleAuthPayload {
  readonly idToken?: string;
  readonly authorizationCode?: string;
  readonly nonce?: string;
  readonly device?: DeviceRegistrationPayload;
}

// ----------------------------------------------------
// Firebase Auth Contracts
// ----------------------------------------------------

export interface FirebaseAuthPayload {
  readonly idToken: string;
  readonly device?: DeviceRegistrationPayload;
}

// ----------------------------------------------------
// Passkey (WebAuthn) Contracts
// ----------------------------------------------------

export interface PasskeyRegisterOptionsResponse {
  readonly challenge: string;
  readonly rp: {
    readonly id: string;
    readonly name: string;
  };
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly displayName: string;
  };
  readonly pubKeyCredParams: ReadonlyArray<{
    readonly alg: number;
    readonly type: 'public-key';
  }>;
  readonly timeout: number;
  readonly authenticatorSelection: {
    readonly residentKey?: 'discouraged' | 'preferred' | 'required';
    readonly userVerification?: 'discouraged' | 'preferred' | 'required';
  };
}

export interface PasskeyRegisterVerifyPayload {
  readonly challenge: string;
  readonly credentialId: string;
  readonly publicKey: string;
  readonly transports?: readonly string[];
  readonly aaguid?: string;
}

export interface PasskeyLoginOptionsPayload {
  readonly emailOrPhone?: string;
}

export interface PasskeyLoginOptionsResponse {
  readonly challenge: string;
  readonly rpId: string;
  readonly timeout: number;
  readonly userVerification: 'discouraged' | 'preferred' | 'required';
}

export interface PasskeyLoginVerifyPayload {
  readonly challenge: string;
  readonly credentialId: string;
  readonly authenticatorData?: string;
  readonly clientDataJSON?: string;
  readonly signature?: string;
  readonly device?: DeviceRegistrationPayload;
}

// ----------------------------------------------------
// Session and Token Lifecycle Contracts
// ----------------------------------------------------

export interface RefreshTokenPayload {
  readonly refreshToken: string;
}

export interface RefreshTokenResponse {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshToken: string;
}

export interface LogoutResponse {
  readonly message: string;
}

export interface SessionItemResponse {
  readonly id: string;
  readonly deviceId?: string | null;
  readonly platform?: string | null;
  readonly deviceModel?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly createdAt: string;
  readonly lastActiveAt?: string | null;
  readonly isCurrentSession: boolean;
}

export interface RevokeSessionResponse {
  readonly message: string;
}

// ----------------------------------------------------
// Device Registry Contracts
// ----------------------------------------------------

export interface DeviceItemResponse {
  readonly id: string;
  readonly userId: string;
  readonly platform: ClientPlatform;
  readonly deviceModel?: string | null;
  readonly appVersion?: string | null;
  readonly pushToken?: string | null;
  readonly lastActiveAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type RegisterDevicePayload = DeviceRegistrationPayload;

export interface RevokeDeviceResponse {
  readonly message: string;
}
