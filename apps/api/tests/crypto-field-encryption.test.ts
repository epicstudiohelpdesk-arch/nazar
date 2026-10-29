import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import { messages } from '../src/infrastructure/database/drizzle/schema/messages.js';
import { conversations } from '../src/infrastructure/database/drizzle/schema/conversations.js';
import { profiles } from '../src/infrastructure/database/drizzle/schema/profiles.js';
import { profilePreferences } from '../src/infrastructure/database/drizzle/schema/profile-preferences.js';
import { FieldEncryptionService } from '../src/common/crypto/field-encryption.service.js';
import { generateUuidV7 } from '@platform/domain';

describe('Military-Grade Security: Field-Level Authenticated Encryption (AES-256-GCM)', () => {
  let app: INestApplication;
  let mockEmailProvider: MockEmailProvider;
  let databaseService: DatabaseService;
  let fieldEncryptionService: FieldEncryptionService;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    mockEmailProvider = app.get<MockEmailProvider>(EMAIL_PROVIDER_TOKEN);
    databaseService = app.get(DatabaseService);
    fieldEncryptionService = app.get(FieldEncryptionService);
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
      dateOfBirth: '1996-03-20',
      gender: 'MAN',
      city: 'Bangalore',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: {
        percentage: 100,
        missingRequired: [],
        recommended: [],
      },
    });

    await databaseService.client.insert(profilePreferences).values({
      id: generateUuidV7(),
      userId,
      minAge: 18,
      maxAge: 40,
      genderPreferences: ['MAN', 'WOMAN'],
      maxDistanceKm: 100,
      relationshipIntent: 'LONG_TERM',
    });

    return { userId, profileId, accessToken, email };
  }

  it('correctly encrypts and decrypts strings using AES-256-GCM with envelope structure', () => {
    const plaintext = 'Top Secret Enterprise Communication #12345';
    const ciphertext = fieldEncryptionService.encrypt(plaintext);

    expect(ciphertext).toMatch(/^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(fieldEncryptionService.isEncrypted(ciphertext)).toBe(true);

    const decrypted = fieldEncryptionService.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('fails closed when ciphertext authentication tag is tampered with', () => {
    const plaintext = 'Immutable payload';
    const ciphertext = fieldEncryptionService.encrypt(plaintext);
    const parts = ciphertext.split(':');
    // parts: ['enc', 'v1', iv, tag, data]
    // Tamper with ciphertext payload
    const tamperedData = 'ff' + parts[4]!.slice(2);
    const tamperedEnvelope = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedData}`;

    expect(() => fieldEncryptionService.decrypt(tamperedEnvelope)).toThrow(
      'Integrity violation: unable to decrypt field payload'
    );
  });

  it('Sprint 1: field encryption key is decoupled from JWT secret rotation', () => {
    // Encrypt payload with the field encryption service
    const sensitive = 'Private message before JWT secret rotation';
    const ciphertext = fieldEncryptionService.encrypt(sensitive);

    // Mock an AppConfigService instance where JWT secrets have been rotated to new values,
    // but FIELD_ENCRYPTION_KEY remains consistent
    const rotatedJwtConfig = {
      jwtAccessSecret: 'new_rotated_jwt_access_secret_32_characters_long_min',
      jwtRefreshSecret: 'new_rotated_jwt_refresh_secret_32_characters_long_min',
      fieldEncryptionKey: app.get(FieldEncryptionService)['configService'].fieldEncryptionKey,
    } as any;

    const newFieldEncryptionService = new FieldEncryptionService(rotatedJwtConfig);

    // Decryption must succeed even after JWT secrets change completely
    const decrypted = newFieldEncryptionService.decrypt(ciphertext);
    expect(decrypted).toBe(sensitive);
  });

  it('verifies that messages stored in PostgreSQL are encrypted at rest with AES-256-GCM while API returns decrypted text', async () => {
    const userA = await createActiveUser('alice_crypto');
    const userB = await createActiveUser('bob_crypto');

    // Mutual like to establish match and conversation
    await request(app.getHttpServer())
      .post(`/v1/interactions/${userB.userId}/like`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    const likeBRes = await request(app.getHttpServer())
      .post(`/v1/interactions/${userA.userId}/like`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(likeBRes.status).toBe(200);
    const matchId = likeBRes.body.data.matchId;
    expect(matchId).toBeDefined();

    const [conv] = await databaseService.client
      .select()
      .from(conversations)
      .where(eq(conversations.matchId, matchId))
      .limit(1);

    expect(conv).toBeDefined();

    const sensitiveMessageText = 'Classified financial & identity details: Account#99827491-X';

    // Send message via API
    const sendRes = await request(app.getHttpServer())
      .post(`/v1/conversations/${conv!.id}/messages`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        clientMessageId: `sec_${generateUuidV7()}`,
        body: sensitiveMessageText,
      });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.message.body).toBe(sensitiveMessageText);

    const messageId = sendRes.body.data.message.id;

    // DIRECT DATABASE AUDIT: Read raw row from PostgreSQL!
    const rawRows = await databaseService.client
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));

    expect(rawRows.length).toBe(1);
    const rawDbBody = rawRows[0]!.body;

    // Raw body in DB MUST NOT contain plaintext
    expect(rawDbBody).not.toContain(sensitiveMessageText);
    expect(rawDbBody).not.toContain('Classified');
    // Raw body in DB MUST be formatted as AES-256-GCM envelope
    expect(rawDbBody).toMatch(/^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

    // Reading back via messages list endpoint returns decrypted text to authorized user
    const listRes = await request(app.getHttpServer())
      .get(`/v1/conversations/${conv!.id}/messages`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(listRes.status).toBe(200);
    const fetched = listRes.body.data.items.find((m: any) => m.id === messageId);
    expect(fetched.body).toBe(sensitiveMessageText);
  });
});
