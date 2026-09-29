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
  userBlocks,
  communities,
  communityMemberships,
  posts,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';

describe('Social Posts, Comments & Reactions (Gate 12)', () => {
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
      dateOfBirth: '1995-06-15',
      gender: 'MAN',
      city: 'Bengaluru',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  describe('Post Lifecycle & Ownership Authorization', () => {
    it('creates, retrieves, updates, and deletes a post', async () => {
      const userA = await createActiveUser('author_a');
      const userB = await createActiveUser('viewer_b');

      // 1. Create post
      const createRes = await request(app.getHttpServer())
        .post('/v1/social/posts')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          content: 'Hello Nazar social network! First post.',
          visibility: 'PUBLIC',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.content).toBe('Hello Nazar social network! First post.');
      expect(createRes.body.data.authorId).toBe(userA.userId);
      const postId = createRes.body.data.id as string;

      // 2. Retrieve post
      const getRes = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(postId);
      expect(getRes.body.data.author.displayName).toBe('author_a User');

      // 3. Unauthorized update from User B
      const badUpdate = await request(app.getHttpServer())
        .patch(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ content: 'Attempted hack' });

      expect(badUpdate.status).toBe(403);
      expect(badUpdate.body.error.code).toBe(ErrorCode.POST_ACCESS_DENIED);

      // 4. Authorized update from User A
      const updateRes = await request(app.getHttpServer())
        .patch(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ content: 'Updated post content by author.' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.content).toBe('Updated post content by author.');

      // 5. Delete post
      const deleteRes = await request(app.getHttpServer())
        .delete(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.success).toBe(true);

      // 6. Post should no longer be accessible
      const postAfterDelete = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(postAfterDelete.status).toBe(404);
      expect(postAfterDelete.body.error.code).toBe(ErrorCode.POST_NOT_FOUND);
    });

    it('allows community moderator to delete post in community', async () => {
      const owner = await createActiveUser('comm_owner');
      const author = await createActiveUser('comm_author');

      // Create community
      const commId = generateUuidV7();
      const rand = Math.random().toString(36).substring(2, 8);
      await databaseService.client.insert(communities).values({
        id: commId,
        creatorId: owner.userId,
        name: `Test Comm ${rand}`,
        slug: `test-comm-${rand}-${commId.slice(-6)}`,
        description: 'Test community',
        privacy: 'PUBLIC',
        memberCount: 2,
      });

      // Memberships
      await databaseService.client.insert(communityMemberships).values([
        {
          id: generateUuidV7(),
          communityId: commId,
          userId: owner.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        {
          id: generateUuidV7(),
          communityId: commId,
          userId: author.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      ]);

      // Author creates post in community
      const postRes = await request(app.getHttpServer())
        .post('/v1/social/posts')
        .set('Authorization', `Bearer ${author.accessToken}`)
        .send({
          content: 'Post inside community',
          communityId: commId,
        });

      expect(postRes.status).toBe(201);
      const postId = postRes.body.data.id as string;

      // Community owner deletes it
      const deleteRes = await request(app.getHttpServer())
        .delete(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.success).toBe(true);
    });
  });

  describe('Feed Pagination & Safety Filtering', () => {
    it('returns deterministic feed with cursor pagination and excludes blocked users', async () => {
      const viewer = await createActiveUser('viewer_feed');
      const author1 = await createActiveUser('author_one');
      const authorBlocked = await createActiveUser('author_blocked');

      // Author 1 creates 3 posts
      for (let i = 1; i <= 3; i++) {
        await request(app.getHttpServer())
          .post('/v1/social/posts')
          .set('Authorization', `Bearer ${author1.accessToken}`)
          .send({ content: `Author 1 post ${i}` });
      }

      // Blocked author creates a post
      const blockedPostRes = await request(app.getHttpServer())
        .post('/v1/social/posts')
        .set('Authorization', `Bearer ${authorBlocked.accessToken}`)
        .send({ content: 'Post from blocked author' });
      const blockedPostId = blockedPostRes.body.data.id as string;

      // Viewer blocks authorBlocked
      await databaseService.client.insert(userBlocks).values({
        id: generateUuidV7(),
        blockerUserId: viewer.userId,
        blockedUserId: authorBlocked.userId,
        createdAt: new Date(),
      });

      // Viewer gets feed with limit 2
      const feedPage1 = await request(app.getHttpServer())
        .get('/v1/social/feed?limit=2')
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      expect(feedPage1.status).toBe(200);
      expect(feedPage1.body.data.items).toHaveLength(2);
      expect(feedPage1.body.data.hasMore).toBe(true);
      expect(feedPage1.body.data.nextCursor).toBeDefined();

      // None of the posts should be from blocked author
      const page1Ids = feedPage1.body.data.items.map((p: { id: string }) => p.id);
      expect(page1Ids).not.toContain(blockedPostId);

      // Page 2 using cursor
      const cursor = feedPage1.body.data.nextCursor as string;
      const feedPage2 = await request(app.getHttpServer())
        .get(`/v1/social/feed?limit=2&cursor=${cursor}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      expect(feedPage2.status).toBe(200);
      const page2Ids = feedPage2.body.data.items.map((p: { id: string }) => p.id);
      expect(page2Ids).not.toContain(blockedPostId);

      // No duplicates between pages
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Comments API', () => {
    it('creates, edits, and deletes comments with correct counts', async () => {
      const author = await createActiveUser('post_author');
      const commenter = await createActiveUser('commenter');
      const stranger = await createActiveUser('stranger');

      const postRes = await request(app.getHttpServer())
        .post('/v1/social/posts')
        .set('Authorization', `Bearer ${author.accessToken}`)
        .send({ content: 'Discussion starter' });
      const postId = postRes.body.data.id as string;

      // 1. Add comment
      const commentRes = await request(app.getHttpServer())
        .post(`/v1/social/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${commenter.accessToken}`)
        .send({ content: 'First comment on discussion!' });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.data.content).toBe('First comment on discussion!');
      const commentId = commentRes.body.data.id as string;

      // Verify post commentCount incremented
      const postAfter = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${author.accessToken}`);
      expect(postAfter.body.data.commentCount).toBe(1);

      // 2. Stranger cannot update comment
      const badEdit = await request(app.getHttpServer())
        .patch(`/v1/social/comments/${commentId}`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .send({ content: 'Unauthorized edit' });
      expect(badEdit.status).toBe(403);
      expect(badEdit.body.error.code).toBe(ErrorCode.COMMENT_ACCESS_DENIED);

      // 3. Commenter updates their comment
      const goodEdit = await request(app.getHttpServer())
        .patch(`/v1/social/comments/${commentId}`)
        .set('Authorization', `Bearer ${commenter.accessToken}`)
        .send({ content: 'Edited comment content.' });
      expect(goodEdit.status).toBe(200);
      expect(goodEdit.body.data.content).toBe('Edited comment content.');

      // 4. Stranger cannot delete comment
      const badDelete = await request(app.getHttpServer())
        .delete(`/v1/social/comments/${commentId}`)
        .set('Authorization', `Bearer ${stranger.accessToken}`);
      expect(badDelete.status).toBe(403);

      // 5. Post author can delete comment
      const deleteRes = await request(app.getHttpServer())
        .delete(`/v1/social/comments/${commentId}`)
        .set('Authorization', `Bearer ${author.accessToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.success).toBe(true);

      // Verify comment count decremented
      const postFinal = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${author.accessToken}`);
      expect(postFinal.body.data.commentCount).toBe(0);
    });
  });

  describe('Reactions API', () => {
    it('handles idempotent like reaction creation and removal', async () => {
      const author = await createActiveUser('post_react_author');
      const reactor = await createActiveUser('post_reactor');

      const postRes = await request(app.getHttpServer())
        .post('/v1/social/posts')
        .set('Authorization', `Bearer ${author.accessToken}`)
        .send({ content: 'React to this!' });
      const postId = postRes.body.data.id as string;

      // 1. Add LIKE reaction
      const r1 = await request(app.getHttpServer())
        .post(`/v1/social/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${reactor.accessToken}`)
        .send({ reactionType: 'LIKE' });

      expect(r1.status).toBe(200);
      expect(r1.body.data.success).toBe(true);

      // Post likeCount is 1
      let post = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${reactor.accessToken}`);
      expect(post.body.data.likeCount).toBe(1);
      expect(post.body.data.userReaction).toBe('LIKE');

      // 2. Repeat LIKE reaction (Idempotent - should not increment likeCount again)
      const r2 = await request(app.getHttpServer())
        .post(`/v1/social/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${reactor.accessToken}`)
        .send({ reactionType: 'LIKE' });

      expect(r2.status).toBe(200);

      post = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${reactor.accessToken}`);
      expect(post.body.data.likeCount).toBe(1);

      // 3. Remove LIKE reaction
      const delReact = await request(app.getHttpServer())
        .delete(`/v1/social/posts/${postId}/reactions/LIKE`)
        .set('Authorization', `Bearer ${reactor.accessToken}`);

      expect(delReact.status).toBe(200);

      post = await request(app.getHttpServer())
        .get(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${reactor.accessToken}`);
      expect(post.body.data.likeCount).toBe(0);
      expect(post.body.data.userReaction).toBeNull();
    });
  });
});
