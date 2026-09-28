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
import type { DiscoveryResponseDto } from '@platform/api-contracts';

describe('Discovery: PostGIS & Reciprocal Candidate Eligibility Pipeline', () => {
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
    };
  }

  it('strictly enforces all eligibility criteria: self-exclusion, active state, completeness, reciprocal age/gender, and PostGIS distance', async () => {
    const client = databaseService.client;

    // 1. Create Viewer (Kolkata: 22.5726, 88.3639, Age 26, MAN, prefers WOMAN 22-30, 50km)
    const viewer = await createAuthenticatedUser('viewer_eligibility');
    const viewerProfileId = generateUuidV7();
    const viewerDob = '2000-01-15'; // 26 yrs

    await client.insert(profiles).values({
      id: viewerProfileId,
      userId: viewer.userId,
      displayName: 'Viewer Man',
      dateOfBirth: viewerDob,
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
      minAge: 22,
      maxAge: 30,
      genderPreferences: ['WOMAN'],
      maxDistanceKm: 50,
      relationshipIntent: 'LONG_TERM',
    });

    // Helper to insert a candidate profile + preferences + ready photo
    async function insertCandidate(opts: {
      tag: string;
      displayName: string;
      dob: string;
      gender: 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER';
      lat: number;
      lng: number;
      visibility: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'HIDDEN';
      missingRequired?: string[];
      prefMinAge: number;
      prefMaxAge: number;
      prefGenders: ('MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER')[];
      prefMaxDistanceKm: number;
      hasReadyPhoto?: boolean;
    }) {
      const user = await createAuthenticatedUser(opts.tag);
      const profileId = generateUuidV7();

      await client.insert(profiles).values({
        id: profileId,
        userId: user.userId,
        displayName: opts.displayName,
        dateOfBirth: opts.dob,
        gender: opts.gender,
        city: 'Kolkata Area',
        countryCode: 'IN',
        latitude: opts.lat,
        longitude: opts.lng,
        visibility: opts.visibility,
        completionStatus: {
          percentage: opts.missingRequired?.length ? 40 : 100,
          missingRequired: opts.missingRequired || [],
          recommended: [],
        },
      });

      await client.execute(
        sql`UPDATE profiles
            SET location = ST_SetSRID(ST_MakePoint(${opts.lng}, ${opts.lat}), 4326)::geography
            WHERE id = ${profileId}`
      );

      await client.insert(profilePreferences).values({
        id: generateUuidV7(),
        userId: user.userId,
        minAge: opts.prefMinAge,
        prefMaxAge: opts.prefMaxAge,
        genderPreferences: opts.prefGenders,
        maxDistanceKm: opts.prefMaxDistanceKm,
        relationshipIntent: 'LONG_TERM',
      } as any);

      if (opts.hasReadyPhoto !== false) {
        await client.insert(profileMedia).values({
          id: generateUuidV7(),
          userId: user.userId,
          profileId,
          objectKey: `candidates/${profileId}/photo1.jpg`,
          mediaType: 'IMAGE',
          mimeType: 'image/jpeg',
          status: 'READY',
          position: 0,
          isPrimary: true,
        });
      }

      return { userId: user.userId, profileId, displayName: opts.displayName };
    }

    // Candidate 1: FULLY ELIGIBLE
    // WOMAN, age 25, 4km away, accepts MAN 20-30, max dist 40km, ACTIVE
    const eligibleCandidate = await insertCandidate({
      tag: 'c_eligible',
      displayName: 'Eligible Priya',
      dob: '2001-04-10', // 25 yrs
      gender: 'WOMAN',
      lat: 22.58, // ~2.5km north
      lng: 88.37,
      visibility: 'ACTIVE',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
    });

    // Candidate 2: Inactive (PAUSED)
    const pausedCandidate = await insertCandidate({
      tag: 'c_paused',
      displayName: 'Paused Riya',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'PAUSED',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
    });

    // Candidate 3: Incomplete (missing required fields)
    const incompleteCandidate = await insertCandidate({
      tag: 'c_incomplete',
      displayName: 'Incomplete Sneha',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'ACTIVE',
      missingRequired: ['PRIMARY_PHOTO'],
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
      hasReadyPhoto: false,
    });

    // Candidate 4: Age Mismatch (Viewer -> Candidate)
    // Candidate age 38 (viewer wants 22-30)
    const ageMismatchCandidate = await insertCandidate({
      tag: 'c_age_mismatch',
      displayName: 'Older Ananya',
      dob: '1988-03-10', // 38 yrs
      gender: 'WOMAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'ACTIVE',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
    });

    // Candidate 5: Reciprocal Age Mismatch (Candidate -> Viewer)
    // Candidate is 25, but candidate only wants 32-45 (viewer is 26)
    const recipAgeMismatchCandidate = await insertCandidate({
      tag: 'c_recip_age',
      displayName: 'Selective Maya',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'ACTIVE',
      prefMinAge: 32,
      prefMaxAge: 45,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
    });

    // Candidate 6: Gender Mismatch (Viewer -> Candidate)
    // Candidate is MAN (viewer wants WOMAN)
    const genderMismatchCandidate = await insertCandidate({
      tag: 'c_gender_mismatch',
      displayName: 'Friend Rahul',
      dob: '2001-04-10',
      gender: 'MAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'ACTIVE',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
    });

    // Candidate 7: Reciprocal Gender Mismatch (Candidate -> Viewer)
    // Candidate is WOMAN, but candidate only wants WOMAN (viewer is MAN)
    const recipGenderMismatchCandidate = await insertCandidate({
      tag: 'c_recip_gender',
      displayName: 'Lesbian Diya',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'ACTIVE',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['WOMAN'],
      prefMaxDistanceKm: 40,
    });

    // Candidate 8: Distance Exceeded (Viewer -> Candidate)
    // Located in Durgapur (~160 km away, viewer max distance is 50 km)
    const distantCandidate = await insertCandidate({
      tag: 'c_distant',
      displayName: 'Distant Tanya',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 23.5204, // Durgapur
      lng: 87.3119,
      visibility: 'ACTIVE',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 200,
    });

    // Candidate 9: Reciprocal Distance Exceeded (Candidate -> Viewer)
    // Located 35 km away (within viewer's 50 km, but candidate's max distance is only 15 km)
    const recipDistantCandidate = await insertCandidate({
      tag: 'c_recip_dist',
      displayName: 'ShortRadius Nisha',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 22.89, // ~35 km north
      lng: 88.4,
      visibility: 'ACTIVE',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 15, // candidate max is only 15 km!
    });

    // Candidate 10: Hidden Profile
    const hiddenCandidate = await insertCandidate({
      tag: 'c_hidden',
      displayName: 'Hidden Pooja',
      dob: '2001-04-10',
      gender: 'WOMAN',
      lat: 22.58,
      lng: 88.37,
      visibility: 'HIDDEN',
      prefMinAge: 22,
      prefMaxAge: 32,
      prefGenders: ['MAN'],
      prefMaxDistanceKm: 40,
    });

    // Query discovery feed for Viewer
    const res = await request(app.getHttpServer())
      .get('/v1/discovery')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const bodyData = res.body.data as DiscoveryResponseDto;
    const returnedProfileIds = bodyData.items.map((i) => i.profile.id);

    // 1. Eligible candidate MUST be present
    expect(returnedProfileIds).toContain(eligibleCandidate.profileId);

    // 2. Self MUST NOT be present
    expect(returnedProfileIds).not.toContain(viewerProfileId);

    // 3. Paused candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(pausedCandidate.profileId);

    // 4. Incomplete candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(incompleteCandidate.profileId);

    // 5. Age mismatch candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(ageMismatchCandidate.profileId);

    // 6. Reciprocal age mismatch candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(recipAgeMismatchCandidate.profileId);

    // 7. Gender mismatch candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(genderMismatchCandidate.profileId);

    // 8. Reciprocal gender mismatch candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(recipGenderMismatchCandidate.profileId);

    // 9. Distant candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(distantCandidate.profileId);

    // 10. Reciprocal distant candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(recipDistantCandidate.profileId);

    // 11. Hidden candidate MUST NOT be present
    expect(returnedProfileIds).not.toContain(hiddenCandidate.profileId);
  });
});
