import { z } from 'zod';
import { uuidSchema } from './chat.js';

// Common pagination schema for social feeds
export const socialCursorQuerySchema = z.object({
  cursor: z.string().trim().min(1, 'Cursor cannot be empty').optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(20),
});

// ----------------------------------------------------
// Posts Validation
// ----------------------------------------------------

export const postVisibilitySchema = z.enum(['PUBLIC', 'COMMUNITY', 'FOLLOWERS'] as const);
export const postReactionTypeSchema = z.enum([
  'LIKE',
  'LOVE',
  'CELEBRATE',
  'SUPPORT',
  'LAUGH',
] as const);

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Post content cannot be empty')
    .max(2000, 'Post content cannot exceed 2000 characters'),
  communityId: uuidSchema.optional().nullable(),
  mediaIds: z.array(uuidSchema).max(4, 'Maximum of 4 media items per post').optional().nullable(),
  visibility: postVisibilitySchema.default('PUBLIC'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Post content cannot be empty')
    .max(2000, 'Post content cannot exceed 2000 characters')
    .optional(),
  visibility: postVisibilitySchema.optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const getPostFeedQuerySchema = socialCursorQuerySchema.extend({
  communityId: uuidSchema.optional(),
});

export type GetPostFeedQueryInput = z.infer<typeof getPostFeedQuerySchema>;

export const postIdParamSchema = z.object({
  id: uuidSchema,
});

export type PostIdParamInput = z.infer<typeof postIdParamSchema>;

// ----------------------------------------------------
// Comments Validation
// ----------------------------------------------------

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters'),
  parentId: uuidSchema.optional().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters'),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const getCommentsQuerySchema = socialCursorQuerySchema;
export type GetCommentsQueryInput = z.infer<typeof getCommentsQuerySchema>;

export const commentIdParamSchema = z.object({
  id: uuidSchema,
});

export type CommentIdParamInput = z.infer<typeof commentIdParamSchema>;

// ----------------------------------------------------
// Reactions Validation
// ----------------------------------------------------

export const addReactionSchema = z.object({
  reactionType: postReactionTypeSchema,
});

export type AddReactionInput = z.infer<typeof addReactionSchema>;

export const removeReactionParamSchema = z.object({
  id: uuidSchema,
  type: postReactionTypeSchema,
});

export type RemoveReactionParamInput = z.infer<typeof removeReactionParamSchema>;

// ----------------------------------------------------
// Communities Validation
// ----------------------------------------------------

export const communityPrivacySchema = z.enum(['PUBLIC', 'PRIVATE', 'HIDDEN'] as const);
export const communityRoleSchema = z.enum(['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'] as const);
export const communityMembershipStatusSchema = z.enum([
  'ACTIVE',
  'PENDING',
  'BANNED',
  'LEFT',
] as const);

export const createCommunitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Community name must be at least 2 characters')
    .max(100, 'Community name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .min(2, 'Community description must be at least 2 characters')
    .max(1000, 'Community description cannot exceed 1000 characters'),
  privacy: communityPrivacySchema.default('PUBLIC'),
  rules: z.array(z.string().trim().max(500)).max(10).optional().nullable(),
  avatarMediaId: uuidSchema.optional().nullable(),
  coverMediaId: uuidSchema.optional().nullable(),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const updateCommunitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Community name must be at least 2 characters')
    .max(100, 'Community name cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(2, 'Community description must be at least 2 characters')
    .max(1000, 'Community description cannot exceed 1000 characters')
    .optional(),
  privacy: communityPrivacySchema.optional(),
  rules: z.array(z.string().trim().max(500)).max(10).optional().nullable(),
  avatarMediaId: uuidSchema.optional().nullable(),
  coverMediaId: uuidSchema.optional().nullable(),
});

export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;

export const communityIdParamSchema = z.object({
  id: uuidSchema,
});

export type CommunityIdParamInput = z.infer<typeof communityIdParamSchema>;

export const communityMemberParamSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
});

export type CommunityMemberParamInput = z.infer<typeof communityMemberParamSchema>;

export const getCommunitiesQuerySchema = socialCursorQuerySchema;
export type GetCommunitiesQueryInput = z.infer<typeof getCommunitiesQuerySchema>;

export const getCommunityMembersQuerySchema = socialCursorQuerySchema;
export type GetCommunityMembersQueryInput = z.infer<typeof getCommunityMembersQuerySchema>;

// ----------------------------------------------------
// Events Validation
// ----------------------------------------------------

export const eventTypeSchema = z.enum(['ONLINE', 'PHYSICAL'] as const);
export const eventStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
  'COMPLETED',
  'ARCHIVED',
] as const);
export const eventRsvpStatusSchema = z.enum([
  'GOING',
  'INTERESTED',
  'CANCELLED',
  'WAITLISTED',
] as const);

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Event title must be at least 2 characters')
    .max(150, 'Event title cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(2, 'Event description must be at least 2 characters')
    .max(3000, 'Event description cannot exceed 3000 characters'),
  communityId: uuidSchema.optional().nullable(),
  type: eventTypeSchema,
  startAt: z.string().datetime({ message: 'startAt must be a valid ISO 8601 date string' }),
  endAt: z.string().datetime({ message: 'endAt must be a valid ISO 8601 date string' }),
  locationName: z
    .string()
    .trim()
    .min(1, 'locationName is required')
    .max(255, 'locationName cannot exceed 255 characters'),
  locationAddress: z.string().trim().max(500).optional().nullable(),
  locationUrl: z.string().trim().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  isWaitlistEnabled: z.boolean().default(true),
  coverMediaId: uuidSchema.optional().nullable(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().min(2).max(3000).optional(),
  type: eventTypeSchema.optional(),
  status: eventStatusSchema.optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  locationName: z.string().trim().min(1).max(255).optional(),
  locationAddress: z.string().trim().max(500).optional().nullable(),
  locationUrl: z.string().trim().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  isWaitlistEnabled: z.boolean().optional(),
  coverMediaId: uuidSchema.optional().nullable(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventIdParamSchema = z.object({
  id: uuidSchema,
});

export type EventIdParamInput = z.infer<typeof eventIdParamSchema>;

export const createRsvpSchema = z.object({
  status: z.enum(['GOING', 'INTERESTED'] as const),
  lookingForPlusOne: z.boolean().optional(),
  plusOneNote: z.string().trim().max(255).optional().nullable(),
});

export type CreateRsvpInput = z.infer<typeof createRsvpSchema>;

export const getEventsQuerySchema = socialCursorQuerySchema.extend({
  communityId: uuidSchema.optional(),
  type: eventTypeSchema.optional(),
});

export type GetEventsQueryInput = z.infer<typeof getEventsQuerySchema>;

export const getAttendeesQuerySchema = socialCursorQuerySchema.extend({
  plusOnesOnly: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});
export type GetAttendeesQueryInput = z.infer<typeof getAttendeesQuerySchema>;
