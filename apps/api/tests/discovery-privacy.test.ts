import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  users,
  profiles,
  profilePreferences,
  profileMedia,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Discovery: Privacy Boundary & Field Sanitization', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAuthenticatedUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    return {
      userId: res.body.data.user.id as string,
      accessToken: res.body.data.accessToken as string,
      email,
    };
  }

  it('guarantees that no private attributes, raw coordinates, DOB, contact information, or internal scores leak into the response', async () => {
    const client = databaseService.client;

    // 1. Viewer
    const viewer = await createAuthenticatedUser('viewer_privacy');
    const viewerProfileId = generateUuidV7();

    await client.insert(profiles).values({
      id: viewerProfileId,
      userId: viewer.userId,
      displayName: 'Privacy Viewer',
      dateOfBirth: '1999-01-01',
      gender: 'MAN',
      city: 'Kolkata',
      countryCode: 'IN',
      latitude: 22.5726,
      longitude: 88.3639,
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    await client.execute(
      sql`UPDATE profiles
          SET location = ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)::geography
          WHERE id = ${viewerProfileId}`
    );

    await client.insert(profilePreferences).values({
      id: generateUuidV7(),
      userId: viewer.userId,
      minAge: 20,
      maxAge: 35,
      genderPreferences: ['WOMAN'],
      maxDistanceKm: 50,
      relationshipIntent: 'LONG_TERM',
    });

    // 2. Candidate with sensitive values
    const candidateUser = await createAuthenticatedUser('privacy_candidate');
    const candProfileId = generateUuidV7();

    await client.insert(profiles).values({
      id: candProfileId,
      userId: candidateUser.userId,
      displayName: 'Secret Candidate',
      dateOfBirth: '2001-08-25',
      gender: 'WOMAN',
      bio: 'Loves mystery and privacy.',
      occupation: 'Architect',
      education: 'University of Arts',
      city: 'Kolkata',
      countryCode: 'IN',
      latitude: 22.578,
      longitude: 88.369,
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    await client.execute(
      sql`UPDATE profiles
          SET location = ST_SetSRID(ST_MakePoint(88.369, 22.578), 4326)::geography
          WHERE id = ${candProfileId}`
    );

    await client.insert(profilePreferences).values({
      id: generateUuidV7(),
      userId: candidateUser.userId,
      minAge: 22,
      maxAge: 30,
      genderPreferences: ['MAN'],
      maxDistanceKm: 40,
      relationshipIntent: 'LONG_TERM',
    });

    await client.insert(profileMedia).values({
      id: generateUuidV7(),
      userId: candidateUser.userId,
      profileId: candProfileId,
      objectKey: `internal-storage-bucket/private-folder/candidates/${candProfileId}/photo.jpg`,
      mediaType: 'IMAGE',
      mimeType: 'image/jpeg',
      status: 'READY',
      position: 0,
      isPrimary: true,
    });

    // 3. Fetch discovery feed
    const res = await request(app.getHttpServer())
      .get('/v1/discovery')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);

    const jsonString = JSON.stringify(res.body);

    // Automated assertions: absolutely forbidden strings and properties
    const forbiddenKeys = [
      'dateOfBirth',
      'date_of_birth',
      'latitude',
      'longitude',
      'phone',
      'phoneNumber',
      candidateUser.email,
      viewer.email,
      'sessionId',
      'session_id',
      'refreshToken',
      'refresh_token',
      'privatePreferences',
      'genderPreferences',
      'gender_preferences',
      'maxDistanceKm',
      'minAge',
      'maxAge',
      'moderationMetadata',
      'rankingFeatures',
      'preferenceCompatibilityScore',
      'profileCompletenessScore',
      'freshnessScore',
      'diversityAdjustment',
      '"objectKey"',
      '"internalStorageKey"',
    ];

    for (const key of forbiddenKeys) {
      expect(
        jsonString.includes(key),
        `Privacy failure: response contains forbidden information "${key}"`
      ).toBe(false);
    }

    // Verify allowed presentation fields are present for the candidate
    const item = res.body.data.items.find(
      (it: { profile: { id: string } }) => it.profile.id === candProfileId
    );
    expect(item).toBeDefined();
    expect(item.profile.id).toBe(candProfileId);
    expect(item.profile.displayName).toBe('Secret Candidate');
    expect(item.profile.age).toBe(25);
    expect(item.profile.gender).toBe('WOMAN');
    expect(item.profile.city).toBe('Kolkata');
    expect(item.distanceBucket).toBe('< 1 km');
    expect(item.profile.media[0].url).toBeDefined();
    expect(typeof item.profile.media[0].url).toBe('string');
  });
});
