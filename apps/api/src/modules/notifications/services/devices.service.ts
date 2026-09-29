import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  type RegisterDeviceRequestDto,
  type DeviceResponseDto,
  type PlatformType,
  type PushProviderType,
} from '@platform/api-contracts';
import {
  DEVICES_REPOSITORY_TOKEN,
  type IDevicesRepository,
} from '../repositories/devices.repository.interface.js';
import type { DeviceRow } from '../../../infrastructure/database/drizzle/schema/devices.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { securityEvents } from '../../../infrastructure/database/drizzle/schema/security-events.js';
import { generateUuidV7 } from '@platform/domain';

function redactToken(token?: string | null): string {
  if (!token) return '***';
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function mapDeviceToDto(device: DeviceRow): DeviceResponseDto {
  return {
    id: device.id,
    userId: device.userId,
    deviceIdentifier: device.deviceIdentifier || device.id,
    platform: (device.platform?.toUpperCase() || 'IOS') as PlatformType,
    pushProvider: (device.pushProvider?.toUpperCase() || 'APNS') as PushProviderType,
    pushTokenRedacted: redactToken(device.pushToken),
    appVersion: device.appVersion,
    osVersion: device.osVersion,
    locale: device.locale,
    timezone: device.timezone,
    lastSeenAt: (device.lastSeenAt || device.createdAt).toISOString(),
    createdAt: device.createdAt.toISOString(),
    revokedAt: device.revokedAt ? device.revokedAt.toISOString() : null,
  };
}

@Injectable()
export class DevicesService {
  constructor(
    @Inject(DEVICES_REPOSITORY_TOKEN)
    private readonly devicesRepo: IDevicesRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async registerDevice(userId: string, dto: RegisterDeviceRequestDto): Promise<DeviceResponseDto> {
    if (!dto.pushToken || dto.pushToken.trim().length === 0) {
      throw new HttpException(
        {
          code: ErrorCode.INVALID_PUSH_TOKEN,
          message: 'Push token must not be empty',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const device = await this.devicesRepo.registerDevice(userId, dto);

    // Audit device registration
    await this.databaseService.client.insert(securityEvents).values({
      id: generateUuidV7(),
      userId,
      eventType: 'device.registered',
      severity: 'INFO',
      metadata: {
        deviceId: device.id,
        platform: device.platform,
        deviceIdentifier: device.deviceIdentifier,
      },
    });

    return mapDeviceToDto(device);
  }

  async listDevices(userId: string): Promise<readonly DeviceResponseDto[]> {
    const devices = await this.devicesRepo.listByUserId(userId);
    return devices.map(mapDeviceToDto);
  }

  async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    const device = await this.devicesRepo.findById(deviceId);
    if (!device) {
      throw new HttpException(
        {
          code: ErrorCode.DEVICE_NOT_FOUND,
          message: 'Device not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (device.userId !== userId) {
      throw new HttpException(
        {
          code: ErrorCode.DEVICE_ACCESS_DENIED,
          message: 'Access denied to device',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const revoked = await this.devicesRepo.revokeDevice(deviceId, userId);

    if (revoked) {
      await this.databaseService.client.insert(securityEvents).values({
        id: generateUuidV7(),
        userId,
        eventType: 'device.revoked',
        severity: 'INFO',
        metadata: {
          deviceId,
        },
      });
    }

    return revoked;
  }
}
