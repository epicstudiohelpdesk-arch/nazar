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

describe('Discovery: Stable Cursor Pagination & Duplicate Prevention', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    const client = databaseService.client;
    await client.execute(
      sql`DELETE FROM profile_media WHERE profile_id IN (SELECT id FROM profiles WHERE city = 'Kolkata');
          DELETE FROM profile_preferences WHERE user_id IN (SELECT user_id FROM profiles WHERE city = 'Kolkata');
          DELETE FROM profile_interests WHERE profile_id IN (SELECT id FROM profiles WHERE city = 'Kolkata');
          DELETE FROM profile_prompts WHERE profile_id IN (SELECT id FROM profiles WHERE city = 'Kolkata');
          DELETE FROM profiles WHERE city = 'Kolkata';`
    );
  }

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

  it('provides duplicate-free, gapless, deterministic cursor-based pagination across multiple pages', async () => {
    const client = databaseService.client;

    // 1. Create Viewer
    const viewer = await createAuthenticatedUser('viewer_pagination');
    const viewerProfileId = generateUuidV7();

    await client.insert(profiles).values({
      id: viewerProfileId,
      userId: viewer.userId,
      displayName: 'Pagination Viewer',
      dateOfBirth: '1998-05-20', // 28 yrs
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
      maxDistanceKm: 60,
      relationshipIntent: 'LONG_TERM',
    });

    // 2. Insert 25 eligible candidates directly into database for fast test setup
    const totalCandidates = 25;
    const candidateProfileIds: string[] = [];

    for (let i = 0; i < totalCandidates; i++) {
      const candidateUser = await createAuthenticatedUser(`pag_cand_${i}`);
      const candProfileId = generateUuidV7();
      candidateProfileIds.push(candProfileId);

      // Distribute distances from 1km to 30km
      const latOffset = i * 0.008;
      const lngOffset = i * 0.008;

      await client.insert(profiles).values({
        id: candProfileId,
        userId: candidateUser.userId,
        displayName: `Candidate ${i + 1}`,
        dateOfBirth: '2001-02-14', // 25 yrs
        gender: 'WOMAN',
        city: 'Kolkata',
        countryCode: 'IN',
        latitude: 22.5726 + latOffset,
        longitude: 88.3639 + lngOffset,
        visibility: 'ACTIVE',
        completionStatus: {
          percentage: 100,
          missingRequired: [],
          recommended: [],
        },
      });

      await client.execute(
        sql`UPDATE profiles
            SET location = ST_SetSRID(ST_MakePoint(${88.3639 + lngOffset}, ${22.5726 + latOffset}), 4326)::geography
            WHERE id = ${candProfileId}`
      );

      await client.insert(profilePreferences).values({
        id: generateUuidV7(),
        userId: candidateUser.userId,
        minAge: 24,
        maxAge: 32,
        genderPreferences: ['MAN'],
        maxDistanceKm: 50,
        relationshipIntent: 'LONG_TERM',
      });

      await client.insert(profileMedia).values({
        id: generateUuidV7(),
        userId: candidateUser.userId,
        profileId: candProfileId,
        objectKey: `candidates/${candProfileId}/photo.jpg`,
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        status: 'READY',
        position: 0,
        isPrimary: true,
      });
    }

    // 3. Paginate through the feed with limit = 8
    const pageSize = 8;
    const allRetrievedIds: string[] = [];
    let currentCursor: string | undefined = undefined;
    let pageNumber = 0;
    const maxPages = 10;

    let page1Ids: string[] = [];

    while (pageNumber < maxPages) {
      pageNumber++;
      const url = currentCursor
        ? `/v1/discovery?limit=${pageSize}&cursor=${encodeURIComponent(currentCursor)}`
        : `/v1/discovery?limit=${pageSize}`;

      const res = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data: DiscoveryResponseDto = res.body.data;
      const pageIds = data.items.map((it) => it.profile.id);

      if (pageNumber === 1) {
        page1Ids = [...pageIds];
      }

      // Check no duplicates in current page
      const uniquePageIds = new Set(pageIds);
      expect(uniquePageIds.size).toBe(pageIds.length);

      // Check no duplicates with previously seen pages
      for (const id of pageIds) {
        expect(allRetrievedIds).not.toContain(id);
        allRetrievedIds.push(id);
      }

      if (!data.pagination.hasMore) {
        expect(data.pagination.nextCursor).toBeNull();
        break;
      }

      expect(data.pagination.nextCursor).toBeDefined();
      expect(typeof data.pagination.nextCursor).toBe('string');
      currentCursor = data.pagination.nextCursor!;
    }

    // Must have retrieved all candidates
    expect(allRetrievedIds.length).toBeGreaterThanOrEqual(totalCandidates);
    for (const id of candidateProfileIds) {
      expect(allRetrievedIds).toContain(id);
    }

    // 4. Repeat Page 1 query and verify determinism
    const repeatPage1Res = await request(app.getHttpServer())
      .get(`/v1/discovery?limit=${pageSize}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    const repeatPage1Ids = (repeatPage1Res.body.data as DiscoveryResponseDto).items.map(
      (it) => it.profile.id
    );

    expect(repeatPage1Ids).toEqual(page1Ids);
  });
});
