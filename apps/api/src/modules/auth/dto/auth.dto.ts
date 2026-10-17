import { z } from 'zod';
import { e164PhoneSchema, standardEmailSchema } from '@platform/validation';

export const checkIdentifierSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  type: z.enum(['PHONE', 'EMAIL']).optional(),
});

export const deviceRegistrationSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  deviceModel: z.string().max(128).optional(),
  appVersion: z.string().max(32).optional(),
  pushToken: z.string().max(512).optional(),
});

export const requestOtpSchema = z.object({
  phoneNumber: e164PhoneSchema,
  deviceId: z.string().max(128).optional(),
});

export const verifyOtpSchema = z.object({
  phoneNumber: e164PhoneSchema,
  code: z.string().trim().min(4).max(10),
  device: deviceRegistrationSchema.optional(),
});

export const requestEmailSchema = z.object({
  email: standardEmailSchema,
});

export const verifyEmailSchema = z.object({
  email: standardEmailSchema,
  code: z.string().trim().min(4).max(10),
  device: deviceRegistrationSchema.optional(),
});

export const googleAuthSchema = z
  .object({
    idToken: z.string().optional(),
    authorizationCode: z.string().optional(),
    codeVerifier: z.string().optional(),
    device: deviceRegistrationSchema.optional(),
  })
  .refine((data) => data.idToken || data.authorizationCode, {
    message: 'Either idToken or authorizationCode is required',
  });

export const appleAuthSchema = z
  .object({
    idToken: z.string().optional(),
    authorizationCode: z.string().optional(),
    nonce: z.string().optional(),
    device: deviceRegistrationSchema.optional(),
  })
  .refine((data) => data.idToken || data.authorizationCode, {
    message: 'Either idToken or authorizationCode is required',
  });

export const firebaseAuthSchema = z.object({
  idToken: z.string().trim().min(1, 'Firebase ID token is required'),
  device: deviceRegistrationSchema.optional(),
});


export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});

export const passkeyRegisterVerifySchema = z.object({
  challenge: z.string().min(1),
  credentialId: z.string().min(1),
  publicKey: z.string().min(1),
  transports: z.array(z.string()).optional(),
  aaguid: z.string().optional(),
});

export const passkeyLoginOptionsSchema = z.object({
  emailOrPhone: z.string().optional(),
});

export const passkeyLoginVerifySchema = z.object({
  challenge: z.string().min(1),
  credentialId: z.string().min(1),
  authenticatorData: z.string().optional(),
  clientDataJSON: z.string().optional(),
  signature: z.string().optional(),
  device: deviceRegistrationSchema.optional(),
});
