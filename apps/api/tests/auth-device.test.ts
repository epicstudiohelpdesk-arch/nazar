import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Auth: Device Management & Object-Level Authorization', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSession(prefix: string) {
    const email = `${prefix.replace(/@.*$/, '')}_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    return {
      userId: res.body.data.user.id,
      accessToken: res.body.data.accessToken as string,
    };
  }

  it('registers device, lists user devices, and allows device revocation', async () => {
    const user = await createSession('device_user1@example.com');

    // 1. Register device
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        platform: 'ios',
        deviceModel: 'iPhone 15 Pro Max',
        appVersion: '1.2.0',
        pushToken: 'apns-test-token-123',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.id).toBeDefined();
    const deviceId = regRes.body.data.id;

    // 2. List devices
    const listRes = await request(app.getHttpServer())
      .get('/v1/auth/devices')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    const found = listRes.body.data.find((d: { id: string }) => d.id === deviceId);
    expect(found).toBeDefined();
    expect(found.platform).toBe('ios');

    // 3. Revoke device
    const delRes = await request(app.getHttpServer())
      .delete(`/v1/auth/devices/${deviceId}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 4. Verify deleted
    const postDelList = await request(app.getHttpServer())
      .get('/v1/auth/devices')
      .set('Authorization', `Bearer ${user.accessToken}`);

    const stillExists = postDelList.body.data.some((d: { id: string }) => d.id === deviceId);
    expect(stillExists).toBe(false);
  });

  it('strictly forbids cross-user device revocation (Object-Level Authorization)', async () => {
    const victim = await createSession('device_victim@example.com');
    const attacker = await createSession('device_attacker@example.com');

    // Register victim device
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/devices')
      .set('Authorization', `Bearer ${victim.accessToken}`)
      .send({
        platform: 'android',
        deviceModel: 'Pixel 8 Pro',
        appVersion: '1.0.0',
      });

    const victimDeviceId = regRes.body.data.id;
    expect(victimDeviceId).toBeDefined();

    // Attacker attempts to delete victim's device
    const exploitRes = await request(app.getHttpServer())
      .delete(`/v1/auth/devices/${victimDeviceId}`)
      .set('Authorization', `Bearer ${attacker.accessToken}`);

    expect(exploitRes.status).toBe(403);
    expect(exploitRes.body.success).toBe(false);
    expect(exploitRes.body.error.code).toBe('FORBIDDEN');

    // Victim device MUST still exist in victim's device list
    const checkRes = await request(app.getHttpServer())
      .get('/v1/auth/devices')
      .set('Authorization', `Bearer ${victim.accessToken}`);

    const victimDevices = checkRes.body.data.map((d: { id: string }) => d.id);
    expect(victimDevices).toContain(victimDeviceId);
  });
});
