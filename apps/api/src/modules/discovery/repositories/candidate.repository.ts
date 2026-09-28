import { Injectable, Inject } from '@nestjs/common';
import { sql, inArray, eq } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  profileInterests,
  interests,
  profilePrompts,
  profilePromptDefinitions,
  profileMedia,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import type {
  InterestItem,
  PublicMediaItem,
  PublicPromptItem,
  Gender,
  RelationshipIntent,
  ProfileCompleteness,
} from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';
import type { CandidateRecord, DiscoveryViewerContext } from '../domain/discovery.types.js';
import type {
  ICandidateRepository,
  HydratedProfileComponents,
} from './candidate.repository.interface.js';

interface RawCandidateRow {
  profileId: string;
  userId: string;
  displayName: string;
  dateOfBirth: string;
  gender: string;
  bio: string | null;
  occupation: string | null;
  education: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: string;
  completionStatus: unknown;
  createdAt: Date;
  updatedAt: Date;
  candidateMinAge: number;
  candidateMaxAge: number;
  candidateGenderPreferences: unknown;
  candidateMaxDistanceKm: number;
  candidateRelationshipIntent: string;
  distanceMeters: number | null;
}

@Injectable()
export class CandidateRepository implements ICandidateRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(S3StorageService)
    private readonly storageService: S3StorageService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findEligibleCandidates(
    context: DiscoveryViewerContext,
    excludedUserIds: readonly string[],
    candidatePoolLimit = 250
  ): Promise<readonly CandidateRecord[]> {
    const hasLocation =
      context.location !== null &&
      context.location !== undefined &&
      typeof context.location.latitude === 'number' &&
      typeof context.location.longitude === 'number';

    const viewerLng = hasLocation ? context.location!.longitude : 0;
    const viewerLat = hasLocation ? context.location!.latitude : 0;
    const viewerMaxDistanceMeters = (context.maxDistanceKm || 50) * 1000;
    const viewerGenderJson = JSON.stringify([context.gender]);

    // Build geospatial selection and conditions
    const distanceSelectSql = hasLocation
      ? sql`ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${viewerLng}, ${viewerLat}), 4326)::geography)`
      : sql`NULL`;

    const locationFilterSql = hasLocation
      ? sql`AND p.location IS NOT NULL
            AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${viewerLng}, ${viewerLat}), 4326)::geography, ${viewerMaxDistanceMeters})
            AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${viewerLng}, ${viewerLat}), 4326)::geography, (pp.max_distance_km * 1000))`
      : sql``;

    const exclusionsSql =
      excludedUserIds.length > 0
        ? sql`AND p.user_id NOT IN (${sql.join(
            excludedUserIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        : sql``;

    const query = sql<RawCandidateRow>`
      SELECT
        p.id AS "profileId",
        p.user_id AS "userId",
        p.display_name AS "displayName",
        p.date_of_birth::text AS "dateOfBirth",
        p.gender AS "gender",
        p.bio AS "bio",
        p.occupation AS "occupation",
        p.education AS "education",
        p.city AS "city",
        p.country_code AS "countryCode",
        p.latitude AS "latitude",
        p.longitude AS "longitude",
        p.visibility AS "visibility",
        p.completion_status AS "completionStatus",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        pp.min_age AS "candidateMinAge",
        pp.max_age AS "candidateMaxAge",
        pp.gender_preferences AS "candidateGenderPreferences",
        pp.max_distance_km AS "candidateMaxDistanceKm",
        pp.relationship_intent AS "candidateRelationshipIntent",
        ${distanceSelectSql} AS "distanceMeters"
      FROM profiles p
      JOIN profile_preferences pp ON pp.user_id = p.user_id
      WHERE p.user_id != ${context.userId}
        AND p.visibility = 'ACTIVE'
        AND (
          (p.completion_status->'missingRequired')::jsonb = '[]'::jsonb
          OR jsonb_array_length(p.completion_status->'missingRequired') = 0
        )
        -- Reciprocal Age Filtering
        AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) >= ${context.minAge}
        AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) <= ${context.maxAge}
        AND pp.min_age <= ${context.age}
        AND pp.max_age >= ${context.age}
        -- Reciprocal Gender Preferences
        AND p.gender = ANY(${sql`ARRAY[${sql.join(
          context.genderPreferences.map((g) => sql`${g}`),
          sql`, `
        )}]::varchar[]`})
        AND pp.gender_preferences @> ${viewerGenderJson}::jsonb
        ${locationFilterSql}
        ${exclusionsSql}
      ORDER BY p.updated_at DESC, p.id ASC
      LIMIT ${candidatePoolLimit}
    `;

    const result = await this.getClient().execute(query);
    const rows = (result.rows || result) as unknown as RawCandidateRow[];

    return rows.map((row) => {
      const age = calculateAge(row.dateOfBirth);
      const genderPrefs: readonly Gender[] = Array.isArray(row.candidateGenderPreferences)
        ? (row.candidateGenderPreferences as Gender[])
        : (['WOMAN', 'MAN', 'NON_BINARY', 'OTHER'] as const);

      const distanceMeters =
        row.distanceMeters !== null && row.distanceMeters !== undefined
          ? Math.round(Number(row.distanceMeters))
          : null;

      return {
        profileId: row.profileId,
        userId: row.userId,
        displayName: row.displayName,
        dateOfBirth: row.dateOfBirth,
        age,
        gender: row.gender as Gender,
        bio: row.bio,
        occupation: row.occupation,
        education: row.education,
        city: row.city,
        countryCode: row.countryCode,
        latitude: row.latitude,
        longitude: row.longitude,
        visibility: row.visibility,
        completionStatus: row.completionStatus as ProfileCompleteness,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        candidateMinAge: Number(row.candidateMinAge),
        candidateMaxAge: Number(row.candidateMaxAge),
        candidateGenderPreferences: genderPrefs,
        candidateMaxDistanceKm: Number(row.candidateMaxDistanceKm),
        candidateRelationshipIntent: row.candidateRelationshipIntent as RelationshipIntent,
        distanceMeters,
      };
    });
  }

  async batchHydrateComponents(
    profileIds: readonly string[]
  ): Promise<Map<string, HydratedProfileComponents>> {
    const map = new Map<string, HydratedProfileComponents>();
    if (profileIds.length === 0) {
      return map;
    }

    // Initialize map
    for (const id of profileIds) {
      map.set(id, { interests: [], prompts: [], media: [] });
    }

    const client = this.getClient();

    // 1. Batch fetch interests
    const interestRows = await client
      .select({
        profileId: profileInterests.profileId,
        id: interests.id,
        name: interests.name,
        slug: interests.slug,
        category: interests.category,
      })
      .from(profileInterests)
      .innerJoin(interests, eq(interests.id, profileInterests.interestId))
      .where(inArray(profileInterests.profileId, [...profileIds]));

    // 2. Batch fetch prompts
    const promptRows = await client
      .select({
        profileId: profilePrompts.profileId,
        id: profilePrompts.id,
        prompt: profilePromptDefinitions.prompt,
        answer: profilePrompts.answer,
        position: profilePrompts.position,
      })
      .from(profilePrompts)
      .innerJoin(
        profilePromptDefinitions,
        eq(profilePromptDefinitions.id, profilePrompts.promptDefinitionId)
      )
      .where(inArray(profilePrompts.profileId, [...profileIds]))
      .orderBy(profilePrompts.position);

    // 3. Batch fetch READY media
    const mediaRows = await client
      .select({
        profileId: profileMedia.profileId,
        id: profileMedia.id,
        objectKey: profileMedia.objectKey,
        position: profileMedia.position,
        isPrimary: profileMedia.isPrimary,
      })
      .from(profileMedia)
      .where(
        sql`${inArray(profileMedia.profileId, [...profileIds])} AND ${eq(profileMedia.status, 'READY')}`
      )
      .orderBy(profileMedia.position);

    // Group interests
    for (const row of interestRows) {
      const existing = map.get(row.profileId);
      if (existing) {
        (existing.interests as InterestItem[]).push({
          id: row.id,
          name: row.name,
          slug: row.slug,
          category: row.category,
        });
      }
    }

    // Group prompts
    for (const row of promptRows) {
      const existing = map.get(row.profileId);
      if (existing) {
        (existing.prompts as PublicPromptItem[]).push({
          id: row.id,
          prompt: row.prompt,
          answer: row.answer,
        });
      }
    }

    // Group media
    for (const row of mediaRows) {
      const existing = map.get(row.profileId);
      if (existing) {
        (existing.media as PublicMediaItem[]).push({
          id: row.id,
          url: this.storageService.getPublicUrl(row.objectKey),
          position: row.position,
          isPrimary: row.isPrimary,
        });
      }
    }

    return map;
  }
}
