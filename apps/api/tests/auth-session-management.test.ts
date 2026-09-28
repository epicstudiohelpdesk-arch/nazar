import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Auth: Session Management & Object-Level Authorization', () => {
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

  async function createSession(emailRaw?: string) {
    const email = emailRaw ?? `sess_mgmt_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    return {
      userId: res.body.data.user.id,
      accessToken: res.body.data.accessToken as string,
      refreshToken: res.body.data.refreshToken as string,
    };
  }

  it('lists active sessions and correctly tags current session', async () => {
    const email = `user_sessions_${generateUuidV7()}@example.com`;
    const s1 = await createSession(email);
    const s2 = await createSession(email);

    const listRes = await request(app.getHttpServer())
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${s2.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);

    // Exactly one session should have isCurrentSession = true
    const currentSessions = listRes.body.data.filter(
      (s: { isCurrentSession: boolean }) => s.isCurrentSession
    );
    expect(currentSessions.length).toBe(1);
  });

  it('allows user to revoke one of their own non-current sessions', async () => {
    const email = `user_revoke_${generateUuidV7()}@example.com`;
    const s1 = await createSession(email);
    const s2 = await createSession(email);

    // Get session list using s2 to find s1's session id
    const listRes = await request(app.getHttpServer())
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${s2.accessToken}`);

    const s1Record = listRes.body.data.find(
      (s: { isCurrentSession: boolean }) => !s.isCurrentSession
    );
    expect(s1Record).toBeDefined();

    // Revoke s1 using s2
    const revokeRes = await request(app.getHttpServer())
      .delete(`/v1/auth/sessions/${s1Record.id}`)
      .set('Authorization', `Bearer ${s2.accessToken}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);

    // s1 refresh must now fail
    const refreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: s1.refreshToken });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe('SESSION_REVOKED');
  });

  it('strictly forbids cross-user session revocation (Object-Level Authorization)', async () => {
    const victim = await createSession(`victim_${generateUuidV7()}@example.com`);
    const attacker = await createSession(`attacker_${generateUuidV7()}@example.com`);

    // Get victim's session ID
    const victimList = await request(app.getHttpServer())
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${victim.accessToken}`);

    const victimSessionId = victimList.body.data[0].id;
    expect(victimSessionId).toBeDefined();

    // Attacker attempts to delete victim's session
    const exploitRes = await request(app.getHttpServer())
      .delete(`/v1/auth/sessions/${victimSessionId}`)
      .set('Authorization', `Bearer ${attacker.accessToken}`);

    expect(exploitRes.status).toBe(403);
    expect(exploitRes.body.success).toBe(false);
    expect(exploitRes.body.error.code).toBe('FORBIDDEN');

    // Victim session MUST remain valid and active!
    const victimCheck = await request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${victim.accessToken}`);

    expect(victimCheck.status).toBe(200);
    expect(victimCheck.body.success).toBe(true);
  });
});
