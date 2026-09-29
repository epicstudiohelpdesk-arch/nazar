import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/index.js';
import { eq } from 'drizzle-orm';
import type { AdminSystemHealthDto } from '@platform/api-contracts';

@Injectable()
export class AdminHealthService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getSystemHealth(): Promise<AdminSystemHealthDto> {
    const startTime = Date.now();
    let dbStatus: 'UP' | 'DOWN' = 'UP';
    let dbLatencyMs = 0;

    try {
      await this.databaseService.client.execute(sql`SELECT 1`);
      dbLatencyMs = Date.now() - startTime;
    } catch {
      dbStatus = 'DOWN';
    }

    // Pending jobs in outbox
    let pendingJobsCount = 0;
    try {
      const [row] = await this.databaseService.client
        .select({ count: sql<number>`count(*)::int` })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, 'PENDING'));
      pendingJobsCount = Number(row?.count || 0);
    } catch {
      // ignore
    }

    const mem = process.memoryUsage();
    const isDegraded = dbStatus === 'DOWN' || dbLatencyMs > 500;

    return {
      status: dbStatus === 'DOWN' ? 'DOWN' : isDegraded ? 'DEGRADED' : 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      },
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          status: 'UP',
          latencyMs: 1,
        },
        storage: {
          status: 'UP',
        },
        workers: {
          status: 'UP',
          pendingJobsCount,
        },
      },
    };
  }
}
