import { z } from "zod";
import { uuidV7Schema } from "../common/id.js";

export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export const phoneOtpRequestSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(
      E164_PHONE_REGEX,
      "Phone number must be in valid E.164 format (e.g. +1234567890)",
    ),
});

export type PhoneOtpRequest = z.infer<typeof phoneOtpRequestSchema>;

export const phoneOtpVerifySchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(
      E164_PHONE_REGEX,
      "Phone number must be in valid E.164 format (e.g. +1234567890)",
    ),
  code: z
    .string()
    .trim()
    .length(6, "Verification code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Verification code must contain digits only"),
  deviceFingerprint: z
    .string()
    .trim()
    .min(8, "Device fingerprint must be at least 8 characters")
    .max(128, "Device fingerprint cannot exceed 128 characters"),
  deviceName: z.string().trim().max(100).optional(),
  platform: z.enum(["ios", "android", "web"]).default("ios"),
});

export type PhoneOtpVerify = z.infer<typeof phoneOtpVerifySchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
  deviceFingerprint: z.string().trim().min(8, "Device fingerprint is required"),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer").default("Bearer"),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authUserSummarySchema = z.object({
  id: uuidV7Schema,
  phoneNumber: z.string(),
  isProfileComplete: z.boolean(),
  isVerified: z.boolean(),
  createdAt: z.string().datetime(),
});

export type AuthUserSummary = z.infer<typeof authUserSummarySchema>;

export const authSessionResponseSchema = z.object({
  tokens: authTokensSchema,
  user: authUserSummarySchema,
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
