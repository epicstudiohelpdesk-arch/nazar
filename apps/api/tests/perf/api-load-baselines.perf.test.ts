import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../test-app.helper.js';
import { DatabaseService } from '../../src/infrastructure/database/database.service.js';
import {
  seedPerfDataset,
  purgePerfDataset,
  type PerfDatasetResult,
} from '../../src/infrastructure/database/seeds/perf-seed.js';
import { sessions } from '../../src/infrastructure/database/drizzle/schema/sessions.js';
import {
  TOKEN_SERVICE_TOKEN,
  type ITokenService,
} from '../../src/modules/auth/tokens/token.interface.js';
import { generateUuidV7 } from '@platform/domain';

export interface EndpointMetric {
  endpoint: string;
  method: string;
  totalRequests: number;
  concurrency: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  rps: number;
  errorRatePercent: number;
}

describe('Performance: Empirical API Load Baselines & Latency Profiling', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let tokenService: ITokenService;
  let perfData: PerfDatasetResult;
  let viewerToken: string;
  let viewerUserId: string;

  const metricsTable: EndpointMetric[] = [];

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);
    tokenService = app.get(TOKEN_SERVICE_TOKEN);

    await purgePerfDataset(databaseService.drizzle);
    perfData = await seedPerfDataset(databaseService.drizzle);

    viewerUserId = perfData.userMapByCluster['London'][0];
    const sessionId = generateUuidV7();
    const refreshToken = tokenService.generateRefreshToken();
    await databaseService.client.insert(sessions).values({
      id: sessionId,
      userId: viewerUserId,
      tokenHash: tokenService.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    });

    viewerToken = tokenService.generateAccessToken({
      sub: viewerUserId,
      sid: sessionId,
      dev: generateUuidV7(),
    });
  });

  afterAll(async () => {
    if (databaseService) {
      await purgePerfDataset(databaseService.drizzle);
    }
    await app.close();

    // Log the comprehensive measured baseline table
    console.log(
      '\n============================================================================================================='
    );
    console.log(
      '                          EMPIRICAL API PERFORMANCE BASELINES (GATE 17)                                     '
    );
    console.log(
      '============================================================================================================='
    );
    console.log(
      'Endpoint'.padEnd(36) +
        'Method'.padEnd(8) +
        'Reqs'.padEnd(6) +
        'p50 (ms)'.padEnd(10) +
        'p90 (ms)'.padEnd(10) +
        'p95 (ms)'.padEnd(10) +
        'p99 (ms)'.padEnd(10) +
        'RPS'.padEnd(10) +
        'Error %'.padEnd(8)
    );
    console.log(
      '-------------------------------------------------------------------------------------------------------------'
    );
    for (const m of metricsTable) {
      console.log(
        m.endpoint.padEnd(36) +
          m.method.padEnd(8) +
          String(m.totalRequests).padEnd(6) +
          m.p50Ms.toFixed(2).padEnd(10) +
          m.p90Ms.toFixed(2).padEnd(10) +
          m.p95Ms.toFixed(2).padEnd(10) +
          m.p99Ms.toFixed(2).padEnd(10) +
          m.rps.toFixed(1).padEnd(10) +
          `${m.errorRatePercent.toFixed(2)}%`.padEnd(8)
      );
    }
    console.log(
      '=============================================================================================================\n'
    );
  });

  async function benchmarkEndpoint(
    endpoint: string,
    method: 'GET' | 'POST',
    bodyFactory?: () => unknown,
    totalRequests = 40,
    concurrency = 10
  ): Promise<EndpointMetric> {
    const latencies: number[] = [];
    let errorCount = 0;
    const overallStartTime = Date.now();

    // Execute in concurrent batches
    const batches = Math.ceil(totalRequests / concurrency);
    for (let b = 0; b < batches; b++) {
      const currentBatchSize = Math.min(concurrency, totalRequests - b * concurrency);
      const batchPromises = Array.from({ length: currentBatchSize }).map(async () => {
        const reqStart = performance.now();
        let status = 0;
        try {
          let req =
            method === 'GET'
              ? request(app.getHttpServer()).get(endpoint)
              : request(app.getHttpServer()).post(endpoint);

          req = req.set('Authorization', `Bearer ${viewerToken}`);
          if (bodyFactory) {
            req = req.send(bodyFactory() as any);
          }

          const res = await req;
          status = res.status;
          if (status >= 400) {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
        const reqDuration = performance.now() - reqStart;
        latencies.push(reqDuration);
      });

      await Promise.all(batchPromises);
    }

    const totalDurationMs = Date.now() - overallStartTime;
    latencies.sort((a, b) => a - b);

    const getPercentile = (pct: number) => {
      const idx = Math.min(Math.floor((pct / 100) * latencies.length), latencies.length - 1);
      return latencies[idx] ?? 0;
    };

    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const mean = sum / latencies.length;
    const rps = totalRequests / (totalDurationMs / 1000);

    const metric: EndpointMetric = {
      endpoint,
      method,
      totalRequests,
      concurrency,
      minMs: Number(latencies[0].toFixed(2)),
      maxMs: Number(latencies[latencies.length - 1].toFixed(2)),
      meanMs: Number(mean.toFixed(2)),
      p50Ms: Number(getPercentile(50).toFixed(2)),
      p90Ms: Number(getPercentile(90).toFixed(2)),
      p95Ms: Number(getPercentile(95).toFixed(2)),
      p99Ms: Number(getPercentile(99).toFixed(2)),
      rps: Number(rps.toFixed(1)),
      errorRatePercent: Number(((errorCount / totalRequests) * 100).toFixed(2)),
    };

    metricsTable.push(metric);
    return metric;
  }

  it('1. GET /v1/health (Baseline Liveness Probe)', async () => {
    const metric = await benchmarkEndpoint('/v1/health', 'GET', undefined, 40, 10);
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(250);
  });

  it('2. GET /v1/profiles/me (Profile Hydration with Preferences & Media)', async () => {
    const metric = await benchmarkEndpoint('/v1/profiles/me', 'GET', undefined, 40, 10);
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(750);
  });

  it('3. GET /v1/discovery (PostGIS Spatial Discovery with Distance Filtering)', async () => {
    const metric = await benchmarkEndpoint('/v1/discovery?limit=20', 'GET', undefined, 30, 10);
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(650);
  });

  it('4. GET /v1/matches (Normalized Match Retrieval with Cursor Pagination)', async () => {
    const metric = await benchmarkEndpoint('/v1/matches?limit=20', 'GET', undefined, 40, 10);
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(250);
  });

  it('5. GET /v1/conversations/:id/messages (Chat History Cursor Pagination)', async () => {
    const convId = perfData.conversationIds[0];
    const metric = await benchmarkEndpoint(
      `/v1/conversations/${convId}/messages?limit=20`,
      'GET',
      undefined,
      40,
      10
    );
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(250);
  });

  it('6. GET /v1/communities (Social Space Discovery)', async () => {
    const metric = await benchmarkEndpoint('/v1/communities', 'GET', undefined, 40, 10);
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(250);
  });

  it('7. POST /v1/analytics/events (Batch Telemetry Ingestion of 10 Events)', async () => {
    const batchPayloadFactory = () => ({
      events: Array.from({ length: 10 }).map((_, i) => ({
        eventId: generateUuidV7(),
        eventName: 'perf.load',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        producer: 'client',
        properties: { batchIndex: i, runType: 'perf-load' },
      })),
    });

    const metric = await benchmarkEndpoint(
      '/v1/analytics/events',
      'POST',
      batchPayloadFactory,
      30,
      10
    );
    expect(metric.errorRatePercent).toBe(0);
    expect(metric.p95Ms).toBeLessThan(250);
  });
});
