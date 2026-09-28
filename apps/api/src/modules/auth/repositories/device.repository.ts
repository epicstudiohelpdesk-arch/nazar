import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import type { DeviceRegistrationPayload } from '@platform/api-contracts';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/drizzle/client.js';
import { devices, type DeviceRow } from '../../../infrastructure/database/drizzle/schema/index.js';

export interface IDeviceRepository {
  registerDevice(
    userId: string,
    payload: DeviceRegistrationPayload,
    db?: DrizzleDatabase
  ): Promise<DeviceRow>;
  listByUserId(userId: string): Promise<DeviceRow[]>;
  findById(deviceId: string): Promise<DeviceRow | null>;
  deleteDevice(deviceId: string, userId: string): Promise<boolean>;
}

export const DEVICE_REPOSITORY_TOKEN = Symbol('IDeviceRepository');

@Injectable()
export class DeviceRepository implements IDeviceRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async registerDevice(
    userId: string,
    payload: DeviceRegistrationPayload,
    db?: DrizzleDatabase
  ): Promise<DeviceRow> {
    const runner = db ?? this.databaseService.client;
    const deviceId = generateUuidV7();

    const [created] = await runner
      .insert(devices)
      .values({
        id: deviceId,
        userId,
        platform: payload.platform,
        deviceModel: payload.deviceModel,
        appVersion: payload.appVersion,
        pushToken: payload.pushToken,
        lastActiveAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to register device');
    }

    return created;
  }

  async listByUserId(userId: string): Promise<DeviceRow[]> {
    return this.databaseService.client.select().from(devices).where(eq(devices.userId, userId));
  }

  async findById(deviceId: string): Promise<DeviceRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    return rows[0] ?? null;
  }

  async deleteDevice(deviceId: string, userId: string): Promise<boolean> {
    const rows = await this.databaseService.client
      .delete(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
      .returning();

    return rows.length > 0;
  }
}
