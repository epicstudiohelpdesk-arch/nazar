import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.helper.js';
import {
  MockEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../src/modules/auth/providers/email.provider.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  profiles,
  entitlements,
  communities,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Communities, Membership & Roles (Gate 12)', () => {
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

    await databaseService.client.insert(profiles).values({
      id: generateUuidV7(),
      userId,
      displayName: `${prefix} User`,
      dateOfBirth: '1992-08-20',
      gender: 'WOMAN',
      city: 'Delhi',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  describe('Community Creation & Entitlements', () => {
    it('creates community, assigns OWNER role, and enforces name uniqueness', async () => {
      const creator = await createActiveUser('comm_creator');
      const uniqueName = `Unique Hiking Club ${generateUuidV7().slice(-6)}`;

      const res = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${creator.accessToken}`)
        .send({
          name: uniqueName,
          description: 'Exploring scenic mountain paths',
          privacy: 'PUBLIC',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(uniqueName);
      expect(res.body.data.currentUserRole).toBe('OWNER');
      expect(res.body.data.currentUserMembershipStatus).toBe('ACTIVE');
      expect(res.body.data.memberCount).toBe(1);

      // Attempt duplicate name
      const dupRes = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${creator.accessToken}`)
        .send({
          name: uniqueName,
          description: 'Another club with same name',
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe(ErrorCode.COMMUNITY_NAME_TAKEN);
    });

    it('enforces free user limit (3 communities max without PREMIUM entitlement)', async () => {
      const user = await createActiveUser('free_user_limit');

      // Create 3 communities
      for (let i = 1; i <= 3; i++) {
        const createRes = await request(app.getHttpServer())
          .post('/v1/communities')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            name: `Free Comm ${i} ${generateUuidV7().slice(-6)}`,
            description: `Free community ${i}`,
          });
        expect(createRes.status).toBe(201);
      }

      // 4th community attempt without PREMIUM should fail
      const fourthAttempt = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: `Free Comm 4 ${generateUuidV7().slice(-6)}`,
          description: '4th community should fail',
        });

      expect(fourthAttempt.status).toBe(403);
      expect(fourthAttempt.body.error.code).toBe(ErrorCode.ENTITLEMENT_REQUIRED);

      // Grant PREMIUM entitlement
      await databaseService.client.insert(entitlements).values({
        id: generateUuidV7(),
        userId: user.userId,
        entitlementCode: 'PREMIUM',
        sourceType: 'SUBSCRIPTION',
        status: 'ACTIVE',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Now 4th community succeeds
      const fourthWithPremium = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: `Free Comm 4 ${generateUuidV7().slice(-6)}`,
          description: '4th community now succeeds with PREMIUM',
        });

      expect(fourthWithPremium.status).toBe(201);
    });
  });

  describe('Public vs Private Community Joining & Approval', () => {
    it('public community join is immediate; member can leave', async () => {
      const owner = await createActiveUser('pub_owner');
      const member = await createActiveUser('pub_member');

      const commRes = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: `Public Music Club ${generateUuidV7().slice(-6)}`,
          description: 'Jamming and live sessions',
          privacy: 'PUBLIC',
        });
      const commId = commRes.body.data.id as string;

      // Member joins
      const joinRes = await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/join`)
        .set('Authorization', `Bearer ${member.accessToken}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.data.status).toBe('ACTIVE');

      // Check member count incremented
      let comm = await request(app.getHttpServer())
        .get(`/v1/communities/${commId}`)
        .set('Authorization', `Bearer ${member.accessToken}`);
      expect(comm.body.data.memberCount).toBe(2);

      // Member leaves
      const leaveRes = await request(app.getHttpServer())
        .delete(`/v1/communities/${commId}/leave`)
        .set('Authorization', `Bearer ${member.accessToken}`);
      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.data.success).toBe(true);

      // Check member count decremented
      comm = await request(app.getHttpServer())
        .get(`/v1/communities/${commId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(comm.body.data.memberCount).toBe(1);

      // Owner cannot leave without transfer
      const ownerLeave = await request(app.getHttpServer())
        .delete(`/v1/communities/${commId}/leave`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(ownerLeave.status).toBe(403);
      expect(ownerLeave.body.error.code).toBe(ErrorCode.COMMUNITY_ACCESS_DENIED);
    });

    it('private community join is PENDING until approved by moderator', async () => {
      const owner = await createActiveUser('priv_owner');
      const applicant = await createActiveUser('priv_applicant');

      const commRes = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: `Private Founders Circle ${generateUuidV7().slice(-6)}`,
          description: 'Exclusive founders group',
          privacy: 'PRIVATE',
        });
      const commId = commRes.body.data.id as string;

      // Join request results in PENDING
      const joinRes = await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/join`)
        .set('Authorization', `Bearer ${applicant.accessToken}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.data.status).toBe('PENDING');

      // Member count should NOT increment yet
      let comm = await request(app.getHttpServer())
        .get(`/v1/communities/${commId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);
      expect(comm.body.data.memberCount).toBe(1);

      // Owner approves applicant
      const approveRes = await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/members/${applicant.userId}/approve`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('ACTIVE');

      // Member count incremented to 2
      comm = await request(app.getHttpServer())
        .get(`/v1/communities/${commId}`)
        .set('Authorization', `Bearer ${applicant.accessToken}`);
      expect(comm.body.data.memberCount).toBe(2);
      expect(comm.body.data.currentUserMembershipStatus).toBe('ACTIVE');
    });
  });

  describe('Moderator Role Actions: Banning & Access Control', () => {
    it('allows owner to ban member; banned member is denied future actions', async () => {
      const owner = await createActiveUser('mod_owner');
      const badMember = await createActiveUser('mod_troublemaker');

      const commRes = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: `Moderation Test ${generateUuidV7().slice(-6)}`,
          description: 'Testing moderation controls',
          privacy: 'PUBLIC',
        });
      const commId = commRes.body.data.id as string;

      // Bad member joins
      await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/join`)
        .set('Authorization', `Bearer ${badMember.accessToken}`);

      // Owner bans bad member
      const banRes = await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/members/${badMember.userId}/ban`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(banRes.status).toBe(200);
      expect(banRes.body.data.success).toBe(true);

      // Bad member cannot rejoin
      const rejoinRes = await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/join`)
        .set('Authorization', `Bearer ${badMember.accessToken}`);

      expect(rejoinRes.status).toBe(403);
      expect(rejoinRes.body.error.code).toBe(ErrorCode.COMMUNITY_MEMBER_BANNED);

      // Bad member cannot ban owner
      const banOwnerAttempt = await request(app.getHttpServer())
        .post(`/v1/communities/${commId}/members/${owner.userId}/ban`)
        .set('Authorization', `Bearer ${badMember.accessToken}`);

      expect(banOwnerAttempt.status).toBe(403);
      expect(banOwnerAttempt.body.error.code).toBe(ErrorCode.COMMUNITY_ACCESS_DENIED);
    });
  });

  describe('Community Feed Isolation', () => {
    it('restricts private community feed to active members only', async () => {
      const owner = await createActiveUser('priv_feed_owner');
      const outsider = await createActiveUser('priv_feed_outsider');

      const commRes = await request(app.getHttpServer())
        .post('/v1/communities')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: `Secret Club ${generateUuidV7().slice(-6)}`,
          description: 'Secret discussions',
          privacy: 'PRIVATE',
        });
      const commId = commRes.body.data.id as string;

      // Owner posts in private community
      await request(app.getHttpServer())
        .post('/v1/social/posts')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          content: 'Confidential secret information',
          communityId: commId,
        });

      // Outsider tries to access private community feed
      const leakAttempt = await request(app.getHttpServer())
        .get(`/v1/communities/${commId}/feed`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(leakAttempt.status).toBe(403);
      expect(leakAttempt.body.error.code).toBe(ErrorCode.COMMUNITY_ACCESS_DENIED);

      // Owner can access feed
      const ownerFeed = await request(app.getHttpServer())
        .get(`/v1/communities/${commId}/feed`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(ownerFeed.status).toBe(200);
      expect(ownerFeed.body.data.items).toHaveLength(1);
      expect(ownerFeed.body.data.items[0]?.content).toBe('Confidential secret information');
    });
  });
});
