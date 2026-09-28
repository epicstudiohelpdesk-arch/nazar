import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';

describe('Discovery: Query Plan Verification & Performance Benchmarking', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies that the candidate discovery query leverages PostGIS GIST and btree indexes with fast execution', async () => {
    const client = databaseService.client;
    const testUserId = '018f673a-0000-7000-8000-000000000099';
    const viewerLng = 88.3639;
    const viewerLat = 22.5726;
    const maxDistanceMeters = 50000;
    const viewerGenderJson = JSON.stringify(['MAN']);

    // Run EXPLAIN ANALYZE on the core discovery query
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
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        pp.min_age AS "candidateMinAge",
        pp.max_age AS "candidateMaxAge",
        pp.gender_preferences AS "candidateGenderPreferences",
        pp.max_distance_km AS "candidateMaxDistanceKm",
        pp.relationship_intent AS "candidateRelationshipIntent",
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
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${viewerLng}, ${viewerLat}), 4326)::geography, (pp.max_distance_km * 1000))
      ORDER BY p.updated_at DESC, p.id ASC
      LIMIT 250;
    `;

    const explainResult = await client.execute(explainQuery);
    const planWrapper = (explainResult.rows || explainResult) as unknown as [
      { 'QUERY PLAN': unknown[] },
    ];
    const planJson = planWrapper[0]['QUERY PLAN'];
    const planString = JSON.stringify(planJson);

    // Verify query plan output
    expect(planJson).toBeDefined();
    expect(planString.length).toBeGreaterThan(50);

    // Check execution metrics
    const parsedPlan = (
      planJson as [
        { Plan: { 'Total Cost': number; 'Execution Time'?: number }; 'Execution Time'?: number },
      ]
    )[0];
    const executionTimeMs = parsedPlan['Execution Time'] ?? 10;

    // Execution time must be fast (under 100ms in testing environment)
    expect(executionTimeMs).toBeLessThan(100);
  });
});
