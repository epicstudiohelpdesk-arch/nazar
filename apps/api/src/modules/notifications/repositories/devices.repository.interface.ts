import type { DeviceRow } from '../../../infrastructure/database/drizzle/schema/devices.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { RegisterDeviceRequestDto } from '@platform/api-contracts';

export interface IDevicesRepository {
  registerDevice(
    userId: string,
    dto: RegisterDeviceRequestDto,
    tx?: DrizzleDatabase
  ): Promise<DeviceRow>;

  findById(deviceId: string, tx?: DrizzleDatabase): Promise<DeviceRow | null>;

  findActiveDevicesByUserId(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly DeviceRow[]>;

  listByUserId(userId: string, tx?: DrizzleDatabase): Promise<readonly DeviceRow[]>;

  revokeDevice(deviceId: string, userId: string, tx?: DrizzleDatabase): Promise<boolean>;

  invalidatePushToken(pushToken: string, tx?: DrizzleDatabase): Promise<number>;
}

export const DEVICES_REPOSITORY_TOKEN = Symbol('IDevicesRepository');
