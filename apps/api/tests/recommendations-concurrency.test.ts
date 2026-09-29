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
  recommendationExposures,
  userRecommendationFeatures,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { RecommendationFeatureWorker } from '../src/modules/recommendations/workers/recommendation-feature.worker.js';

describe('Recommendations Concurrency & Worker Resilience (Gate 13)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let worker: RecommendationFeatureWorker;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
    worker = app.get(RecommendationFeatureWorker);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveUser(prefix: string, gender: 'MAN' | 'WOMAN' | 'NON_BINARY' = 'MAN') {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1996-01-15',
      gender,
      city: 'Kolkata',
      countryCode: 'IN',
      latitude: 22.5726,
      longitude: 88.3639,
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    await databaseService.client.execute(sql`
      UPDATE profiles
      SET location = ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)
      WHERE id = ${profileId}
    `);

    await databaseService.client.insert(profilePreferences).values({
      id: generateUuidV7(),
      profileId,
      userId,
      minAge: 18,
      maxAge: 45,
      genderPreferences: ['MAN', 'WOMAN'],
      maxDistanceKm: 50,
      relationshipIntent: 'LONG_TERM',
    });

    return { userId, profileId, accessToken };
  }

  it('handles 10 concurrent recommendation requests for the same viewer safely', async () => {
    const viewer = await createActiveUser('concurrent_viewer', 'MAN');
    await createActiveUser('concurrent_cand_1', 'WOMAN');
    await createActiveUser('concurrent_cand_2', 'WOMAN');

    const requests = Array.from({ length: 10 }).map((_, idx) =>
      request(app.getHttpServer())
        .get('/v1/recommendations?mode=PERSONALIZED_DISCOVERY&limit=5')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .set('x-request-id', `req-concurrent-${idx}`)
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    }
  });

  it('handles concurrent feature worker recalculations idempotently', async () => {
    const user = await createActiveUser('worker_user', 'WOMAN');

    // Run 5 concurrent worker recomputations for the same user
    const computations = Array.from({ length: 5 }).map(() =>
      worker.recomputeFeaturesForUser(user.userId, 'v1')
    );

    const results = await Promise.all(computations);

    for (const r of results) {
      expect(r.userId).toBe(user.userId);
      expect(r.featureVersion).toBe('v1');
      expect(r.features).toBeDefined();
    }

    // Verify exactly one row exists in user_recommendation_features due to unique constraint on (userId, featureVersion)
    const rows = await databaseService.client
      .select()
      .from(userRecommendationFeatures)
      .where(eq(userRecommendationFeatures.userId, user.userId));

    expect(rows).toHaveLength(1);
  });

  it('worker maintenance cleanup old exposures operates cleanly', async () => {
    const result = await worker.cleanupOldExposures(30);
    expect(result).toBeDefined();
    expect(typeof result.deleted).toBe('number');
  });
});
