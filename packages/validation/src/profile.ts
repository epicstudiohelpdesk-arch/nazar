import { z } from 'zod';

export type Gender = 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER';

export interface ProfileCompleteness {
  readonly percentage: number;
  readonly missingRequired: readonly string[];
  readonly recommended: readonly string[];
}

/**
 * Calculates a person's exact integer age from date of birth.
 */
export function calculateAge(dob: Date | string, referenceDate: Date = new Date()): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(birth.getTime())) {
    throw new Error('Invalid date of birth provided');
  }

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Strict Date of Birth validator enforcing calendar validity and 18-120 age boundaries.
 */
export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
  .refine(
    (dobStr) => {
      const d = new Date(dobStr);
      if (Number.isNaN(d.getTime())) return false;
      const [year, month, day] = dobStr.split('-').map(Number);
      return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
    },
    { message: 'Invalid calendar date' }
  )
  .refine(
    (dobStr) => {
      const d = new Date(dobStr);
      return d.getTime() <= Date.now();
    },
    { message: 'Date of birth cannot be in the future' }
  )
  .refine(
    (dobStr) => {
      const age = calculateAge(dobStr);
      return age >= 18;
    },
    { message: 'Users must be at least 18 years old' }
  )
  .refine(
    (dobStr) => {
      const age = calculateAge(dobStr);
      return age <= 120;
    },
    { message: 'Invalid date of birth: age cannot exceed 120' }
  );

export const genderSchema = z.enum(['MAN', 'WOMAN', 'NON_BINARY', 'OTHER'] as const);

export const profileVisibilitySchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'HIDDEN'] as const);

export const relationshipIntentSchema = z.enum([
  'LONG_TERM',
  'SHORT_TERM',
  'CASUAL',
  'FRIENDSHIP',
  'NOT_SURE',
] as const);

export const familyPlansSchema = z.enum([
  'WANTS_CHILDREN',
  'DONT_WANT_CHILDREN',
  'OPEN_TO_CHILDREN',
  'NOT_SURE',
] as const);

export type FamilyPlans = z.infer<typeof familyPlansSchema>;

export const mediaTypeSchema = z.enum(['IMAGE', 'VIDEO'] as const);

export const mediaStatusSchema = z.enum([
  'PENDING',
  'UPLOADING',
  'PROCESSING',
  'READY',
  'REJECTED',
  'DELETED',
] as const);

export const allowedMediaMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  longitude: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
});

export const createProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(64, 'Display name cannot exceed 64 characters'),
  dateOfBirth: dateOfBirthSchema,
  gender: genderSchema,
  bio: z.string().trim().max(500, 'Bio cannot exceed 500 characters').optional(),
  occupation: z.string().trim().max(128).optional(),
  education: z.string().trim().max(128).optional(),
  city: z.string().trim().max(128).optional(),
  countryCode: z
    .string()
    .trim()
    .length(2, 'Country code must be 2-letter ISO code')
    .toUpperCase()
    .optional(),
  location: coordinatesSchema.optional(),
  relationshipIntent: relationshipIntentSchema.optional(),
  familyPlans: familyPlansSchema.optional(),
  incognitoMode: z.boolean().optional(),
  smartPhotos: z.boolean().optional(),
  travelMode: z.boolean().optional(),
  travelLatitude: z.number().min(-90).max(90).optional().nullable(),
  travelLongitude: z.number().min(-180).max(180).optional().nullable(),
  travelCity: z.string().trim().max(128).optional().nullable(),
  travelCountry: z.string().trim().max(128).optional().nullable(),
});

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(64, 'Display name cannot exceed 64 characters')
    .optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  gender: genderSchema.optional(),
  bio: z.string().trim().max(500, 'Bio cannot exceed 500 characters').optional().nullable(),
  occupation: z.string().trim().max(128).optional().nullable(),
  education: z.string().trim().max(128).optional().nullable(),
  city: z.string().trim().max(128).optional().nullable(),
  countryCode: z
    .string()
    .trim()
    .length(2, 'Country code must be 2-letter ISO code')
    .toUpperCase()
    .optional()
    .nullable(),
  location: coordinatesSchema.optional().nullable(),
  relationshipIntent: relationshipIntentSchema.optional().nullable(),
  familyPlans: familyPlansSchema.optional().nullable(),
  incognitoMode: z.boolean().optional().nullable(),
  smartPhotos: z.boolean().optional().nullable(),
  travelMode: z.boolean().optional().nullable(),
  travelLatitude: z.number().min(-90).max(90).optional().nullable(),
  travelLongitude: z.number().min(-180).max(180).optional().nullable(),
  travelCity: z.string().trim().max(128).optional().nullable(),
  travelCountry: z.string().trim().max(128).optional().nullable(),
});

export const toggleSmartPhotosSchema = z.object({
  enabled: z.boolean(),
});

export type ToggleSmartPhotosInput = z.infer<typeof toggleSmartPhotosSchema>;

export const setPassportLocationSchema = z
  .object({
    enabled: z.boolean(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    city: z.string().trim().max(128).optional().nullable(),
    country: z.string().trim().max(128).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.enabled) {
        return typeof data.latitude === 'number' && typeof data.longitude === 'number';
      }
      return true;
    },
    {
      message: 'Latitude and longitude are required when enabling Passport / Travel Mode',
      path: ['latitude'],
    }
  );

export type SetPassportLocationInput = z.infer<typeof setPassportLocationSchema>;

export const updatePreferencesSchema = z
  .object({
    minAge: z
      .number()
      .int()
      .min(18, 'Minimum age is 18')
      .max(99, 'Minimum age cannot exceed 99')
      .optional(),
    maxAge: z
      .number()
      .int()
      .min(18, 'Maximum age must be at least 18')
      .max(120, 'Maximum age cannot exceed 120')
      .optional(),
    ageIsDealbreaker: z.boolean().optional(),
    genderPreferences: z
      .array(genderSchema)
      .min(1, 'Select at least one gender preference')
      .optional(),
    maxDistanceKm: z
      .number()
      .int()
      .min(1, 'Distance must be at least 1 km')
      .max(500, 'Distance cannot exceed 500 km')
      .optional(),
    distanceIsDealbreaker: z.boolean().optional(),
    relationshipIntent: relationshipIntentSchema.optional(),
    intentIsDealbreaker: z.boolean().optional(),
    familyPlans: familyPlansSchema.optional().nullable(),
    familyPlansIsDealbreaker: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.minAge !== undefined && data.maxAge !== undefined) {
        return data.minAge <= data.maxAge;
      }
      return true;
    },
    {
      message: 'Minimum age cannot exceed maximum age',
      path: ['minAge'],
    }
  );

export const updateInterestsSchema = z.object({
  interestIds: z
    .array(z.string().uuid('Invalid interest ID'))
    .min(0)
    .max(10, 'Maximum 10 interests allowed'),
});

export const updatePromptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        promptDefinitionId: z.string().uuid('Invalid prompt definition ID'),
        answer: z
          .string()
          .trim()
          .min(2, 'Prompt answer must be at least 2 characters')
          .max(500, 'Prompt answer cannot exceed 500 characters'),
        position: z.number().int().min(0).max(5).optional(),
      })
    )
    .max(3, 'Maximum 3 prompts allowed')
    .refine((prompts) => {
      const ids = new Set(prompts.map((p) => p.promptDefinitionId));
      return ids.size === prompts.length;
    }),
});
export const createAudioPromptSchema = z.object({
  promptDefinitionId: z.string().uuid('Invalid prompt definition ID'),
  audioUrl: z.string().url('Invalid audio URL'),
  durationSeconds: z
    .number()
    .int('Duration must be an integer')
    .min(1, 'Audio prompt must be at least 1 second')
    .max(60, 'Audio prompt cannot exceed 60 seconds'),
  waveformPeaks: z.array(z.number().min(0).max(1)).max(100).optional(),
});

export type CreateAudioPromptInput = z.infer<typeof createAudioPromptSchema>;

export const mediaUploadSchema = z.object({
  mimeType: z.enum(allowedMediaMimeTypes, {
    errorMap: () => ({ message: 'Unsupported media MIME type. Supported: jpeg, png, webp, heic' }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(10 * 1024 * 1024, 'File size exceeds maximum 10MB limit'),
});

export const reorderMediaSchema = z.object({
  mediaIds: z
    .array(z.string().uuid('Invalid media ID'))
    .min(1, 'Must provide at least one media ID')
    .max(6, 'Maximum 6 media items allowed')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Duplicate media IDs in reorder payload',
    }),
});

/**
 * Deterministic profile completeness calculator.
 */
export function calculateProfileCompleteness(params: {
  displayName?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: Gender | null;
  hasPrimaryPhoto: boolean;
  hasPreferences: boolean;
  bio?: string | null;
  interestsCount: number;
  occupation?: string | null;
  education?: string | null;
  promptsCount: number;
  readyPhotosCount: number;
}): ProfileCompleteness {
  const missingRequired: string[] = [];
  const recommended: string[] = [];

  // Required checks (60% total weight: 12% each)
  let earnedScore = 0;

  if (params.displayName && params.displayName.trim().length >= 2) {
    earnedScore += 12;
  } else {
    missingRequired.push('DISPLAY_NAME');
  }

  if (params.dateOfBirth) {
    try {
      const age = calculateAge(params.dateOfBirth);
      if (age >= 18) {
        earnedScore += 12;
      } else {
        missingRequired.push('DATE_OF_BIRTH');
      }
    } catch {
      missingRequired.push('DATE_OF_BIRTH');
    }
  } else {
    missingRequired.push('DATE_OF_BIRTH');
  }

  if (params.gender) {
    earnedScore += 12;
  } else {
    missingRequired.push('GENDER');
  }

  if (params.hasPrimaryPhoto && params.readyPhotosCount >= 1) {
    earnedScore += 12;
  } else {
    missingRequired.push('PRIMARY_PHOTO');
  }

  if (params.hasPreferences) {
    earnedScore += 12;
  } else {
    missingRequired.push('PREFERENCES');
  }

  // Recommended checks (40% total weight: ~6.67% each, capped at 100)
  if (params.bio && params.bio.trim().length >= 10) {
    earnedScore += 7;
  } else {
    recommended.push('BIO');
  }

  if (params.interestsCount >= 3) {
    earnedScore += 7;
  } else {
    recommended.push('INTERESTS');
  }

  if (params.occupation && params.occupation.trim().length > 0) {
    earnedScore += 6;
  } else {
    recommended.push('OCCUPATION');
  }

  if (params.education && params.education.trim().length > 0) {
    earnedScore += 6;
  } else {
    recommended.push('EDUCATION');
  }

  if (params.promptsCount >= 1) {
    earnedScore += 7;
  } else {
    recommended.push('PROMPTS');
  }

  if (params.readyPhotosCount >= 2) {
    earnedScore += 7;
  } else {
    recommended.push('ADDITIONAL_PHOTOS');
  }

  const percentage = Math.min(100, Math.round(earnedScore));

  return {
    percentage,
    missingRequired,
    recommended,
  };
}
