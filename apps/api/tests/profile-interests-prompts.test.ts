import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { generateUuidV7 } from '@platform/domain';

describe('Profile: Curated Interests & Prompts Taxonomy & User Selections', () => {
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

  async function createSession() {
    const email = `interests_prompts_${generateUuidV7()}@example.com`;
    await request(app.getHttpServer()).post('/v1/auth/email/request-verification').send({ email });
    const code = mockEmailProvider.getLastCode(email)!;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/email/verify')
      .send({ email, code });

    return {
      userId: res.body.data.user.id as string,
      accessToken: res.body.data.accessToken as string,
    };
  }

  it('lists curated active interests taxonomy publicly via GET /v1/interests', async () => {
    const res = await request(app.getHttpServer()).get('/v1/interests');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('name');
    expect(res.body.data[0]).toHaveProperty('slug');
    expect(res.body.data[0]).toHaveProperty('category');
  });

  it('lists curated dating prompt definitions publicly via GET /v1/prompts', async () => {
    const res = await request(app.getHttpServer()).get('/v1/prompts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('prompt');
    expect(res.body.data[0]).toHaveProperty('category');
  });

  it('sets profile interests idempotently and replaces old selections', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 25}-05-05`;

    // 1. Create base profile
    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'Kavita', dateOfBirth: dob, gender: 'WOMAN' });

    // 2. Fetch taxonomy
    const taxonomyRes = await request(app.getHttpServer()).get('/v1/interests');
    const allInterests = taxonomyRes.body.data;
    const firstTwo = [allInterests[0].id, allInterests[1].id];

    // 3. Set first two interests
    const putRes1 = await request(app.getHttpServer())
      .put('/v1/profiles/me/interests')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ interestIds: firstTwo });

    expect(putRes1.status).toBe(200);
    expect(putRes1.body.data.length).toBe(2);

    // 4. Replace with next three interests (verifies idempotent complete replacement)
    const nextThree = [allInterests[2].id, allInterests[3].id, allInterests[4].id];
    const putRes2 = await request(app.getHttpServer())
      .put('/v1/profiles/me/interests')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ interestIds: nextThree });

    expect(putRes2.status).toBe(200);
    expect(putRes2.body.data.length).toBe(3);
    const updatedIds = putRes2.body.data.map((i: any) => i.id);
    expect(updatedIds).toEqual(expect.arrayContaining(nextThree));
    expect(updatedIds).not.toContain(firstTwo[0]);
  });

  it('rejects interest update when non-existent interest ID is submitted with 404 INTEREST_NOT_FOUND', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 25}-05-05`;

    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'Dev', dateOfBirth: dob, gender: 'MAN' });

    const fakeInterestId = generateUuidV7();
    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me/interests')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ interestIds: [fakeInterestId] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INTEREST_NOT_FOUND');
  });

  it('sets profile prompt answers and rejects answers exceeding maximum character limit', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 27}-08-10`;

    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'Ananya', dateOfBirth: dob, gender: 'WOMAN' });

    const promptsTaxonomyRes = await request(app.getHttpServer()).get('/v1/prompts');
    const validPrompt = promptsTaxonomyRes.body.data[0];

    // 1. Valid prompt answer
    const validRes = await request(app.getHttpServer())
      .put('/v1/profiles/me/prompts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        prompts: [
          {
            promptDefinitionId: validPrompt.id,
            answer: 'A perfect weekend morning is hiking through misty pines.',
          },
        ],
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.length).toBe(1);
    expect(validRes.body.data[0].promptDefinitionId).toBe(validPrompt.id);
    expect(validRes.body.data[0].answer).toBe(
      'A perfect weekend morning is hiking through misty pines.'
    );

    // 2. Reject answers exceeding 500 characters
    const longAnswer = 'A'.repeat(501);
    const invalidRes = await request(app.getHttpServer())
      .put('/v1/profiles/me/prompts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        prompts: [
          {
            promptDefinitionId: validPrompt.id,
            answer: longAnswer,
          },
        ],
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects prompts with non-existent promptDefinitionId with 404 PROMPT_NOT_FOUND', async () => {
    const session = await createSession();
    const dob = `${new Date().getFullYear() - 25}-05-05`;

    await request(app.getHttpServer())
      .put('/v1/profiles/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'Ravi', dateOfBirth: dob, gender: 'MAN' });

    const fakePromptId = generateUuidV7();
    const res = await request(app.getHttpServer())
      .put('/v1/profiles/me/prompts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        prompts: [
          {
            promptDefinitionId: fakePromptId,
            answer: 'Random thoughts...',
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROMPT_NOT_FOUND');
  });
});
