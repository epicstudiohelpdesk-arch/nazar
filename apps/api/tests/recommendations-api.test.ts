import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  profilePreferences,
  userBlocks,
  userRestrictions,
  recommendationExposures,
  recommendationModelVersions,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Recommendations & Personalization Engine API Tests (Gate 13)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);

    // Seed default model version if none exists
    const [existingModel] = await databaseService.client
      .select()
      .from(recommendationModelVersions)
      .where(eq(recommendationModelVersions.version, 'v1'));

    if (!existingModel) {
      await databaseService.client.insert(recommendationModelVersions).values({
        id: generateUuidV7(),
        version: 'v1',
        name: 'DeterministicRecommendationModelV1',
        mode: 'PERSONALIZED_DISCOVERY',
        isActive: true,
        weights: {
          preferenceCompatibility: 0.25,
          sharedInterests: 0.2,
          socialAffinity: 0.15,
          activityFreshness: 0.15,
          profileQuality: 0.15,
          reciprocalSignal: 0.1,
        },
        config: {
          exposurePenaltyPerCount: 0.08,
          maxExposurePenalty: 0.4,
          explorationRate: 0.05,
          freshnessHalfLifeHours: 48,
        },
        rolloutPercentage: 100,
        createdAt: new Date(),
        activatedAt: new Date(),
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveUser(
    prefix: string,
    gender: 'MAN' | 'WOMAN' | 'NON_BINARY' = 'MAN',
    preferences: {
      minAge?: number;
      maxAge?: number;
      genderPreferences?: string[];
      maxDistanceKm?: number;
      relationshipIntent?: string;
    } = {}
  ) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;
    const profileId = generateUuidV7();

    // Insert profile with location
    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1998-05-15',
      gender,
      city: 'Kolkata',
      countryCode: 'IN',
      latitude: 22.5726,
      longitude: 88.3639,
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    // Set PostGIS point
    await databaseService.client.execute(sql`
      UPDATE profiles
      SET location = ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)
      WHERE id = ${profileId}
    `);

    // Insert reciprocal preferences
    await databaseService.client.insert(profilePreferences).values({
      id: generateUuidV7(),
      profileId,
      userId,
      minAge: preferences.minAge ?? 18,
      maxAge: preferences.maxAge ?? 40,
      genderPreferences: preferences.genderPreferences ?? ['MAN', 'WOMAN', 'NON_BINARY'],
      maxDistanceKm: preferences.maxDistanceKm ?? 50,
      relationshipIntent: preferences.relationshipIntent ?? 'LONG_TERM',
    });

    return { userId, profileId, accessToken };
  }

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer()).get('/v1/recommendations');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects recommendation request if user profile does not exist with 400 PROFILE_NOT_READY', async () => {
    const email = `noprofile_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const accessToken = res.body.data.accessToken as string;

    const recRes = await request(app.getHttpServer())
      .get('/v1/recommendations')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(recRes.status).toBe(400);
    expect(recRes.body.success).toBe(false);
    expect(recRes.body.error.code).toBe(ErrorCode.PROFILE_NOT_READY);
  });

  it('rejects user with active DISCOVERY restriction with 403 PROFILE_RESTRICTED', async () => {
    const user = await createActiveUser('restricted_user');

    // Impose active restriction
    await databaseService.client.insert(userRestrictions).values({
      id: generateUuidV7(),
      userId: user.userId,
      restrictionType: 'DISCOVERY',
      reasonCode: 'POLICY_VIOLATION',
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .get('/v1/recommendations')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.PROFILE_RESTRICTED);
  });

  it('returns personalized recommendations with pagination metadata and items', async () => {
    const viewer = await createActiveUser('rec_viewer', 'MAN', {
      genderPreferences: ['WOMAN'],
    });

    // Create eligible female candidates
    const candidate1 = await createActiveUser('rec_cand_1', 'WOMAN', {
      genderPreferences: ['MAN'],
    });
    const candidate2 = await createActiveUser('rec_cand_2', 'WOMAN', {
      genderPreferences: ['MAN'],
    });

    const res = await request(app.getHttpServer())
      .get('/v1/recommendations?mode=PERSONALIZED_DISCOVERY&limit=10')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(typeof res.body.data.hasMore).toBe('boolean');
    expect(res.body.data.recommendationVersion).toBe('v1');
    expect(res.body.data.mode).toBe('PERSONALIZED_DISCOVERY');

    // Confirm that returned items have PublicProfileResponse without internal scoring leaks
    const foundCandidate = res.body.data.items.find(
      (i: any) => i.profile.userId === candidate1.userId
    );
    if (foundCandidate) {
      expect(foundCandidate.profile.id).toBe(candidate1.profileId);
      expect(foundCandidate.profile.displayName).toBe('rec_cand_1 User');
      expect(foundCandidate.profile.score).toBeUndefined(); // NO SCORE LEAK
      expect(foundCandidate.breakdown).toBeUndefined(); // NO BREAKDOWN LEAK
      expect(foundCandidate.distanceBucket).toBeDefined();
    }
  });

  it('strictly excludes blocked users from recommendations', async () => {
    const viewer = await createActiveUser('block_viewer', 'MAN', {
      genderPreferences: ['WOMAN'],
    });
    const candidateBlocked = await createActiveUser('block_cand', 'WOMAN', {
      genderPreferences: ['MAN'],
    });

    // Insert block (viewer blocked candidate)
    await databaseService.client.insert(userBlocks).values({
      id: generateUuidV7(),
      blockerUserId: viewer.userId,
      blockedUserId: candidateBlocked.userId,
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .get('/v1/recommendations?mode=PERSONALIZED_DISCOVERY&limit=20')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    const candidateIds = res.body.data.items.map((i: any) => i.profile.userId);
    expect(candidateIds).not.toContain(candidateBlocked.userId);
  });

  it('logs candidate exposures when recommendations are surfaced', async () => {
    const viewer = await createActiveUser('expo_viewer', 'MAN', {
      genderPreferences: ['WOMAN'],
    });
    const candidate = await createActiveUser('expo_cand', 'WOMAN', {
      genderPreferences: ['MAN'],
    });

    const res = await request(app.getHttpServer())
      .get('/v1/recommendations?mode=PERSONALIZED_DISCOVERY&limit=10')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);

    // Give asynchronous exposure write time to finish
    await new Promise((r) => setTimeout(r, 200));

    const exposures = await databaseService.client
      .select()
      .from(recommendationExposures)
      .where(eq(recommendationExposures.viewerUserId, viewer.userId));

    expect(exposures.length).toBeGreaterThanOrEqual(1);
    expect(exposures[0]!.recommendationMode).toBe('PERSONALIZED_DISCOVERY');
    expect(exposures[0]!.recommendationVersion).toBe('v1');
  });

  it('retrieves user features via GET /v1/recommendations/features/me', async () => {
    const user = await createActiveUser('feature_user', 'WOMAN');

    const res = await request(app.getHttpServer())
      .get('/v1/recommendations/features/me')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(user.userId);
    expect(res.body.data.featureVersion).toBe('v1');
    expect(res.body.data.features).toBeDefined();
    expect(res.body.data.features.profileCompleteness).toBe(100);
  });

  it('retrieves registered model versions via GET /v1/recommendations/models', async () => {
    const user = await createActiveUser('model_viewer');

    const res = await request(app.getHttpServer())
      .get('/v1/recommendations/models')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].version).toBe('v1');
    expect(res.body.data[0].weights).toBeDefined();
  });
});
