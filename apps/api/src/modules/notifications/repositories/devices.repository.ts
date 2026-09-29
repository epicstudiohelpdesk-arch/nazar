import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  devices,
  type DeviceRow,
} from '../../../infrastructure/database/drizzle/schema/devices.js';
import { generateUuidV7 } from '@platform/domain';
import type { RegisterDeviceRequestDto } from '@platform/api-contracts';
import type { IDevicesRepository } from './devices.repository.interface.js';

@Injectable()
export class DevicesRepository implements IDevicesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async registerDevice(
    userId: string,
    dto: RegisterDeviceRequestDto,
    tx?: DrizzleDatabase
  ): Promise<DeviceRow> {
    const client = this.getClient(tx);
    const now = new Date();

    // 1. Account switching protection (Section 40):
    // If this push token or device identifier is currently assigned to a DIFFERENT user,
    // revoke it immediately so old user notifications never leak to this device.
    await client
      .update(devices)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          sql`${devices.userId} != ${userId}`,
          or(
            eq(devices.pushToken, dto.pushToken),
            eq(devices.deviceIdentifier, dto.deviceIdentifier)
          )
        )
      );

    // 2. Check if a device with this deviceIdentifier already exists for this user
    const [existing] = await client
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), eq(devices.deviceIdentifier, dto.deviceIdentifier)))
      .limit(1);

    const provider = dto.pushProvider || (dto.platform === 'ANDROID' ? 'FCM' : 'APNS');

    if (existing) {
      // Token rotation / metadata update
      const [updated] = await client
        .update(devices)
        .set({
          platform: dto.platform,
          pushProvider: provider,
          pushToken: dto.pushToken,
          appVersion: dto.appVersion || existing.appVersion,
          osVersion: dto.osVersion || existing.osVersion,
          locale: dto.locale || existing.locale,
          timezone: dto.timezone || existing.timezone,
          lastSeenAt: now,
          revokedAt: null, // restore if previously revoked
          updatedAt: now,
        })
        .where(eq(devices.id, existing.id))
        .returning();

      return updated!;
    }

    // 3. New device registration
    const [created] = await client
      .insert(devices)
      .values({
        id: generateUuidV7(),
        userId,
        platform: dto.platform,
        pushProvider: provider,
        pushToken: dto.pushToken,
        deviceIdentifier: dto.deviceIdentifier,
        appVersion: dto.appVersion || null,
        osVersion: dto.osVersion || null,
        locale: dto.locale || null,
        timezone: dto.timezone || null,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
      })
      .returning();

    return created!;
  }

  async findById(deviceId: string, tx?: DrizzleDatabase): Promise<DeviceRow | null> {
    const client = this.getClient(tx);
    const [device] = await client.select().from(devices).where(eq(devices.id, deviceId)).limit(1);

    return device || null;
  }

  async findActiveDevicesByUserId(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly DeviceRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.userId, userId),
          sql`${devices.revokedAt} IS NULL`,
          sql`${devices.pushToken} IS NOT NULL`
        )
      );
  }

  async listByUserId(userId: string, tx?: DrizzleDatabase): Promise<readonly DeviceRow[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(sql`${devices.lastSeenAt} DESC`);
  }

  async revokeDevice(deviceId: string, userId: string, tx?: DrizzleDatabase): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .update(devices)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
      .returning({ id: devices.id });

    return result.length > 0;
  }

  async invalidatePushToken(pushToken: string, tx?: DrizzleDatabase): Promise<number> {
    const client = this.getClient(tx);
    const result = await client
      .update(devices)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(devices.pushToken, pushToken), sql`${devices.revokedAt} IS NULL`))
      .returning({ id: devices.id });

    return result.length;
  }
}
