import { z } from "zod";
import { uuidV7Schema } from "../common/id.js";

export enum Gender {
  MAN = "MAN",
  WOMAN = "WOMAN",
  NON_BINARY = "NON_BINARY",
  OTHER = "OTHER",
}

export enum DatingIntent {
  LONG_TERM = "LONG_TERM",
  SHORT_TERM = "SHORT_TERM",
  NEW_FRIENDS = "NEW_FRIENDS",
  CASUAL = "CASUAL",
  UNDECIDED = "UNDECIDED",
}

export enum ModerationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  FLAGGED = "FLAGGED",
}

export enum VerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

export const mediaItemSchema = z.object({
  id: uuidV7Schema,
  url: z.string().url(),
  blurhash: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0).max(8),
  isPrimary: z.boolean(),
  moderationStatus: z
    .nativeEnum(ModerationStatus)
    .default(ModerationStatus.PENDING),
});

export type MediaItem = z.infer<typeof mediaItemSchema>;

/**
 * Validates that birthDate corresponds to an individual at least 18 years old.
 */
export function validateAge18OrOlder(birthDateStr: string): boolean {
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age >= 18 && age <= 120;
}

export const userProfileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .optional(),
  birthDate: z
    .string()
    .refine(validateAge18OrOlder, {
      message: "You must be at least 18 years old to join Nazar",
    })
    .optional(),
  gender: z.nativeEnum(Gender).optional(),
  bio: z
    .string()
    .trim()
    .max(500, "Bio cannot exceed 500 characters")
    .optional(),
  datingIntent: z.nativeEnum(DatingIntent).optional(),
  interests: z
    .array(z.string().trim().max(30))
    .max(10, "Maximum 10 interests allowed")
    .optional(),
});

export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;

export const userProfileResponseSchema = z.object({
  id: uuidV7Schema,
  displayName: z.string(),
  birthDate: z.string(),
  age: z.number().int().min(18),
  gender: z.nativeEnum(Gender),
  bio: z.string().nullable(),
  datingIntent: z.nativeEnum(DatingIntent).nullable(),
  interests: z.array(z.string()),
  media: z.array(mediaItemSchema),
  isVerified: z.boolean(),
  verificationStatus: z.nativeEnum(VerificationStatus),
  moderationStatus: z.nativeEnum(ModerationStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
