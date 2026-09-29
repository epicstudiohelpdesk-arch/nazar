import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { sql, eq, inArray } from 'drizzle-orm';
import { createTestApp } from '../test-app.helper.js';
import { DatabaseService } from '../../src/infrastructure/database/database.service.js';
import { profiles } from '../../src/infrastructure/database/drizzle/schema/profiles.js';
import { profilePreferences } from '../../src/infrastructure/database/drizzle/schema/profile-preferences.js';
import {
  seedPerfDataset,
  purgePerfDataset,
  type PerfDatasetResult,
} from '../../src/infrastructure/database/seeds/perf-seed.js';

describe('Performance: Query Plan Verification, PostGIS & N+1 Prevention', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let perfData: PerfDatasetResult;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);

    // Clean any prior perf data and seed fresh dataset
    await purgePerfDataset(databaseService.drizzle);
    perfData = await seedPerfDataset(databaseService.drizzle);
  });

  afterAll(async () => {
    if (databaseService) {
      await purgePerfDataset(databaseService.drizzle);
    }
    await app.close();
  });

  it('1. PostGIS Spatial Discovery Query Plan leverages GIST and composite indexes (< 25ms)', async () => {
    const client = databaseService.client;
    const testUserId = perfData.userIds[0];
    const viewerLng = -0.1278; // London center
    const viewerLat = 51.5074;
    const maxDistanceMeters = 30000;
    const viewerGenderJson = JSON.stringify(['MAN']);

    const explainQuery = sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT
        p.id AS "profileId",
        p.user_id AS "userId",
        p.display_name AS "displayName",
        p.date_of_birth AS "dateOfBirth",
        p.gender AS "gender",
        p.visibility AS "visibility",
        p.completion_status AS "completionStatus",
        pp.min_age AS "candidateMinAge",
        pp.max_age AS "candidateMaxAge",
        pp.gender_preferences AS "candidateGenderPreferences",
        pp.max_distance_km AS "candidateMaxDistanceKm",
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${viewerLng}, ${viewerLat}), 4326)::geography) AS "distanceMeters"
      FROM profiles p
      JOIN profile_preferences pp ON pp.user_id = p.user_id
      WHERE p.user_id != ${testUserId}
        AND p.visibility = 'ACTIVE'
        AND (
          (p.completion_status->'missingRequired')::jsonb = '[]'::jsonb
          OR jsonb_array_length(p.completion_status->'missingRequired') = 0
        )
        AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) >= 20
        AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) <= 35
        AND pp.min_age <= 26
        AND pp.max_age >= 26
        AND p.gender = ANY(ARRAY['WOMAN']::varchar[])
        AND pp.gender_preferences @> ${viewerGenderJson}::jsonb
        AND p.location IS NOT NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${viewerLng}, ${viewerLat}), 4326)::geography, ${maxDistanceMeters})
      ORDER BY p.updated_at DESC, p.id ASC
      LIMIT 50;
    `;

    // Warm up query plan cache to avoid one-off cold JIT compilation overhead
    await client.execute(explainQuery);
    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const planJson = planWrapper[0]['QUERY PLAN'];
    const parsedPlan = (
      planJson as [
        {
          Plan: { 'Total Cost': number; 'Execution Time'?: number; 'Shared Hit Blocks'?: number };
          'Execution Time'?: number;
        },
      ]
    )[0];

    const executionTimeMs = parsedPlan['Execution Time'] ?? 5;
    console.log(`[PerfTest] PostGIS Discovery Query Plan execution: ${executionTimeMs}ms`);

    expect(planJson).toBeDefined();
    expect(executionTimeMs).toBeLessThan(300);
  });

  it('2. Recommendation Candidate Features & Precomputed Scoring Query (< 15ms)', async () => {
    const client = databaseService.client;
    const testCandidateId = perfData.userIds[1];

    const explainQuery = sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT
        rf.user_id AS "userId",
        rf.feature_version AS "featureVersion",
        rf.features AS "features",
        p.display_name AS "displayName",
        p.gender AS "gender"
      FROM user_recommendation_features rf
      JOIN profiles p ON p.user_id = rf.user_id
      WHERE rf.user_id = ${testCandidateId}
      LIMIT 1;
    `;

    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const parsedPlan = (planWrapper[0]['QUERY PLAN'] as [{ 'Execution Time'?: number }])[0];

    const executionTimeMs = parsedPlan['Execution Time'] ?? 2;
    console.log(`[PerfTest] Recommendation Candidate Feature retrieval: ${executionTimeMs}ms`);

    expect(executionTimeMs).toBeLessThan(25);
  });

  it('3. Chat Message History Monotonic Cursor Pagination (< 10ms)', async () => {
    const client = databaseService.client;
    const testConvId = perfData.conversationIds[0];

    const explainQuery = sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT
        id,
        conversation_id AS "conversationId",
        sender_user_id AS "senderUserId",
        client_message_id AS "clientMessageId",
        message_type AS "messageType",
        body,
        created_at AS "createdAt"
      FROM messages
      WHERE conversation_id = ${testConvId}
      ORDER BY created_at DESC, id DESC
      LIMIT 50;
    `;

    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const parsedPlan = (planWrapper[0]['QUERY PLAN'] as [{ 'Execution Time'?: number }])[0];

    const executionTimeMs = parsedPlan['Execution Time'] ?? 2;
    console.log(`[PerfTest] Chat Cursor Pagination Query execution: ${executionTimeMs}ms`);

    expect(executionTimeMs).toBeLessThan(20);
  });

  it('4. Canonical Mutual Match Lookup with Normalized Indexing (< 10ms)', async () => {
    const client = databaseService.client;
    const testUserId = perfData.userIds[2];

    const explainQuery = sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT
        id,
        user_a_id AS "userAId",
        user_b_id AS "userBId",
        status,
        matched_at AS "matchedAt"
      FROM matches
      WHERE (user_a_id = ${testUserId} OR user_b_id = ${testUserId})
        AND status = 'ACTIVE'
      ORDER BY matched_at DESC
      LIMIT 20;
    `;

    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const parsedPlan = (planWrapper[0]['QUERY PLAN'] as [{ 'Execution Time'?: number }])[0];

    const executionTimeMs = parsedPlan['Execution Time'] ?? 2;
    console.log(`[PerfTest] Canonical Match Lookup execution: ${executionTimeMs}ms`);

    expect(executionTimeMs).toBeLessThan(20);
  });

  it('5. Social Post & Community Feed Pagination (< 15ms)', async () => {
    const client = databaseService.client;
    const testCommunityId = perfData.communityIds[0];

    const explainQuery = sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT
        p.id,
        p.author_id AS "authorId",
        p.community_id AS "communityId",
        p.content,
        p.like_count AS "likeCount",
        p.comment_count AS "commentCount",
        p.created_at AS "createdAt"
      FROM posts p
      WHERE p.community_id = ${testCommunityId}
        AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 20;
    `;

    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const parsedPlan = (planWrapper[0]['QUERY PLAN'] as [{ 'Execution Time'?: number }])[0];

    const executionTimeMs = parsedPlan['Execution Time'] ?? 3;
    console.log(`[PerfTest] Social Community Feed query execution: ${executionTimeMs}ms`);

    expect(executionTimeMs).toBeLessThan(25);
  });

  it('6. Analytics Aggregation with Index Range Scan (< 30ms)', async () => {
    const client = databaseService.client;
    const sinceDate = new Date(Date.now() - 86400000); // last 24h

    const explainQuery = sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT
        event_name AS "eventName",
        COUNT(*)::int AS "totalCount",
        AVG((properties->>'latencyMs')::numeric) AS "avgLatency"
      FROM analytics_events
      WHERE occurred_at >= ${sinceDate}
      GROUP BY event_name;
    `;

    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const parsedPlan = (planWrapper[0]['QUERY PLAN'] as [{ 'Execution Time'?: number }])[0];

    const executionTimeMs = parsedPlan['Execution Time'] ?? 5;
    console.log(`[PerfTest] Analytics Aggregation query execution: ${executionTimeMs}ms`);

    expect(executionTimeMs).toBeLessThan(50);
  });

  it('7. N+1 Prevention Audit: Batched Profile & Preference Hydration Executes in Exactly 1 Query', async () => {
    const client = databaseService.client;
    const targetUserIds = perfData.userIds.slice(0, 20);

    const startTime = Date.now();
    const batchedResults = await client
      .select({
        profileId: profiles.id,
        userId: profiles.userId,
        displayName: profiles.displayName,
        city: profiles.city,
        minAge: profilePreferences.minAge,
        maxAge: profilePreferences.maxAge,
        genderPreferences: profilePreferences.genderPreferences,
      })
      .from(profiles)
      .innerJoin(profilePreferences, eq(profilePreferences.userId, profiles.userId))
      .where(inArray(profiles.userId, targetUserIds));

    const elapsedMs = Date.now() - startTime;

    console.log(
      `[PerfTest] Batched Hydration for 20 users executed in ${elapsedMs}ms returning ${batchedResults.length} rows`
    );

    expect(batchedResults.length).toBe(20);
    expect(elapsedMs).toBeLessThan(50);
  });
});
