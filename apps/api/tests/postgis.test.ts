import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DATABASE_SERVICE_TOKEN } from '../src/infrastructure/database/database.tokens.js';
import type { DatabaseService } from '../src/infrastructure/database/database.service.js';

describe('PostGIS Geospatial Engine Integration', () => {
  let app: INestApplication;
  let dbService: DatabaseService;

  beforeAll(async () => {
    const testSetup = await createTestApp();
    app = testSetup.app;
    dbService = app.get<DatabaseService>(DATABASE_SERVICE_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should verify PostGIS extension version 3.x is active', async () => {
    const result = await dbService.drizzle.execute<{ postgis_version: string }>(
      sql`SELECT PostGIS_Version() AS postgis_version;`
    );

    expect(result.rows).toHaveLength(1);
    const version = result.rows[0].postgis_version;
    expect(version).toBeDefined();
    expect(version).toMatch(/^3\./);
  });

  it('should calculate geodesic distance between NYC and London using ST_Distance', async () => {
    // NYC: lng -74.0060, lat 40.7128
    // London: lng -0.1278, lat 51.5074
    // Great circle distance is ~5,570 km = 5,570,000 meters
    const query = sql<{ distance_meters: number }>`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326)::geography,
        ST_SetSRID(ST_MakePoint(-0.1278, 51.5074), 4326)::geography
      ) AS distance_meters;
    `;

    const result = await dbService.drizzle.execute(query);
    expect(result.rows).toHaveLength(1);

    const distance = Number(result.rows[0].distance_meters);
    expect(distance).toBeGreaterThan(5_500_000);
    expect(distance).toBeLessThan(5_650_000);
  });

  it('should evaluate geospatial proximity with ST_DWithin on SRID 4326 geography', async () => {
    // SF Ferry Building: lng -122.3937, lat 37.7955
    // Golden Gate Bridge: lng -122.4783, lat 37.8199 (~7.8 km apart)
    // NYC: lng -74.0060, lat 40.7128 (~4,130 km apart)

    const query = sql<{ is_within_10km: boolean; is_nyc_within_100km: boolean }>`
      SELECT
        ST_DWithin(
          ST_SetSRID(ST_MakePoint(-122.3937, 37.7955), 4326)::geography,
          ST_SetSRID(ST_MakePoint(-122.4783, 37.8199), 4326)::geography,
          10000
        ) AS is_within_10km,
        ST_DWithin(
          ST_SetSRID(ST_MakePoint(-122.3937, 37.7955), 4326)::geography,
          ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326)::geography,
          100000
        ) AS is_nyc_within_100km;
    `;

    const result = await dbService.drizzle.execute(query);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].is_within_10km).toBe(true);
    expect(result.rows[0].is_nyc_within_100km).toBe(false);
  });
});
