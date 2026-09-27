import { z } from "zod";
import { uuidV7Schema } from "../common/id.js";
import { DatingIntent, Gender, mediaItemSchema } from "../user/schemas.js";

export enum SwipeAction {
  LIKE = "LIKE",
  PASS = "PASS",
  SUPERLIKE = "SUPERLIKE",
}

export const discoveryPreferencesSchema = z
  .object({
    minAge: z.number().int().min(18).max(100).default(18),
    maxAge: z.number().int().min(18).max(100).default(50),
    maxDistanceKm: z.number().int().min(1).max(500).default(50),
    genderPreferences: z
      .array(z.nativeEnum(Gender))
      .min(1, "Select at least one gender preference"),
    datingIntents: z.array(z.nativeEnum(DatingIntent)).optional(),
  })
  .refine((data) => data.minAge <= data.maxAge, {
    message: "minAge cannot be greater than maxAge",
    path: ["minAge"],
  });

export type DiscoveryPreferences = z.infer<typeof discoveryPreferencesSchema>;

export const discoveryCandidateSchema = z.object({
  userId: uuidV7Schema,
  displayName: z.string(),
  age: z.number().int().min(18),
  bio: z.string().nullable(),
  datingIntent: z.nativeEnum(DatingIntent).nullable(),
  interests: z.array(z.string()),
  media: z.array(mediaItemSchema),
  distanceKm: z.number().nonnegative(),
  isVerified: z.boolean(),
});

export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;

export const swipeRequestSchema = z.object({
  targetUserId: uuidV7Schema,
  action: z.nativeEnum(SwipeAction),
  idempotencyKey: uuidV7Schema,
});

export type SwipeRequest = z.infer<typeof swipeRequestSchema>;

export const swipeResponseSchema = z.object({
  action: z.nativeEnum(SwipeAction),
  isMatch: z.boolean(),
  matchId: uuidV7Schema.nullable(),
});

export type SwipeResponse = z.infer<typeof swipeResponseSchema>;
