import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  devices,
  securityEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('Notifications & Devices: Device Registration Lifecycle', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveUser(prefix: string) {
    const email = `${prefix}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    const userId = res.body.data.user.id as string;
    const accessToken = res.body.data.accessToken as string;
    const profileId = generateUuidV7();

    await databaseService.client.insert(profiles).values({
      id: profileId,
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1998-05-15',
      gender: 'WOMAN',
      city: 'Mumbai',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    return { userId, profileId, accessToken };
  }

  it('registers a device with client-safe hardware info and redacts push token', async () => {
    const user = await createActiveUser('dev_reg_a');
    const rawPushToken = 'apns_raw_token_super_secret_xyz_987654321';

    const res = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        deviceIdentifier: 'hardware-vendor-id-001',
        platform: 'IOS',
        pushToken: rawPushToken,
        appVersion: '1.2.0',
        osVersion: '18.1',
        locale: 'en_IN',
        timezone: 'Asia/Kolkata',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.platform).toBe('IOS');
    expect(res.body.data.pushProvider).toBe('APNS');
    expect(res.body.data.deviceIdentifier).toBe('hardware-vendor-id-001');

    // Token must be redacted in response
    expect(res.body.data.pushTokenRedacted).toBe('apns...4321');
    expect(res.body.data.pushToken).toBeUndefined();

    // Verify persisted in DB with security event
    const [row] = await databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, res.body.data.id));

    expect(row).toBeDefined();
    expect(row?.pushToken).toBe(rawPushToken);
    expect(row?.userId).toBe(user.userId);

    const [secEvent] = await databaseService.client
      .select()
      .from(securityEvents)
      .where(and(eq(securityEvents.userId, user.userId), eq(securityEvents.eventType, 'device.registered')));
    expect(secEvent).toBeDefined();
  });

  it('rotates push token when registering existing device identifier', async () => {
    const user = await createActiveUser('dev_rot_a');

    // Initial registration
    const initialRes = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        deviceIdentifier: 'hardware-rot-002',
        platform: 'ANDROID',
        pushToken: 'fcm_old_token_1111111111111',
      });

    expect(initialRes.status).toBe(200);
    const initialDeviceId = initialRes.body.data.id;

    // Token rotation
    const rotatedRes = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        deviceIdentifier: 'hardware-rot-002',
        platform: 'ANDROID',
        pushToken: 'fcm_new_token_9999999999999',
      });

    expect(rotatedRes.status).toBe(200);
    expect(rotatedRes.body.data.id).toBe(initialDeviceId);
    expect(rotatedRes.body.data.pushTokenRedacted).toBe('fcm_...9999');

    // Verify DB updated
    const [row] = await databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, initialDeviceId));

    expect(row?.pushToken).toBe('fcm_new_token_9999999999999');
    expect(row?.revokedAt).toBeNull();
  });

  it('enforces account switching security (Section 40): device registration severs prior user association', async () => {
    const userA = await createActiveUser('switch_user_a');
    const userB = await createActiveUser('switch_user_b');
    const sharedDeviceIdentifier = 'shared-tablet-hardware-id-777';
    const sharedPushToken = 'apns_token_shared_tablet_99999999';

    // 1. User A registers device
    const resA = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        deviceIdentifier: sharedDeviceIdentifier,
        platform: 'IOS',
        pushToken: sharedPushToken,
      });

    expect(resA.status).toBe(200);
    const deviceAId = resA.body.data.id;

    // 2. User B logs into the same physical device and registers
    const resB = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({
        deviceIdentifier: sharedDeviceIdentifier,
        platform: 'IOS',
        pushToken: sharedPushToken,
      });

    expect(resB.status).toBe(200);
    expect(resB.body.data.userId).toBe(userB.userId);

    // 3. User A's device association must be revoked!
    const [deviceARow] = await databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, deviceAId));

    expect(deviceARow?.revokedAt).not.toBeNull();

    // User B's active device list must have the active device
    const listResB = await request(app.getHttpServer())
      .get('/v1/devices')
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(listResB.body.data).toHaveLength(1);
    expect(listResB.body.data[0]?.deviceIdentifier).toBe(sharedDeviceIdentifier);
  });

  it('supports multiple active devices for a single user', async () => {
    const user = await createActiveUser('multi_dev_user');

    // Register iPhone
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        deviceIdentifier: 'iphone-hardware-id',
        platform: 'IOS',
        pushToken: 'apns_token_iphone_11111111',
      });

    // Register Android Tablet
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        deviceIdentifier: 'android-tablet-hardware-id',
        platform: 'ANDROID',
        pushToken: 'fcm_token_tablet_22222222',
      });

    const listRes = await request(app.getHttpServer())
      .get('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
  });

  it('allows owner to revoke a device and prevents cross-user revocation', async () => {
    const userA = await createActiveUser('rev_user_a');
    const userB = await createActiveUser('rev_user_b');

    const regRes = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        deviceIdentifier: 'to-be-revoked-dev',
        platform: 'IOS',
        pushToken: 'apns_token_to_be_revoked',
      });

    const deviceId = regRes.body.data.id;

    // User B tries to revoke User A's device -> 403
    const crossRevokeRes = await request(app.getHttpServer())
      .delete(`/v1/devices/${deviceId}`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(crossRevokeRes.status).toBe(403);

    // User A revokes their own device -> 200
    const ownerRevokeRes = await request(app.getHttpServer())
      .delete(`/v1/devices/${deviceId}`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(ownerRevokeRes.status).toBe(200);
    expect(ownerRevokeRes.body.data.revoked).toBe(true);

    // Verify revokedAt in DB
    const [row] = await databaseService.client
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId));

    expect(row?.revokedAt).not.toBeNull();
  });
});
