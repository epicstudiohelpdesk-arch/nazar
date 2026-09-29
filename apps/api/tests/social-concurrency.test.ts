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
  communityMemberships,
  postReactions,
  eventRsvps,
  posts,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { eq, and } from 'drizzle-orm';

describe('Social, Communities & Events: Concurrency & Race Conditions (Gate 12)', () => {
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
    const email = `${prefix}_${Math.random().toString(36).substring(2, 8)}_${generateUuidV7()}@example.com`;
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
      dateOfBirth: '1994-06-15',
      gender: 'WOMAN',
      city: 'Mumbai',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  it('10 simultaneous community joins -> exactly 1 membership row (idempotent)', async () => {
    const owner = await createActiveUser('comm_owner');
    const member = await createActiveUser('comm_racer');

    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const commRes = await request(app.getHttpServer())
      .post('/v1/communities')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: `Concurrency Club ${randomSuffix}`,
        description: 'Testing concurrency',
        privacy: 'PUBLIC',
      });
    expect(commRes.status).toBe(201);
    const communityId = commRes.body.data.id;

    // Fire 10 simultaneous join requests by the same user
    const joinPromises = Array.from({ length: 10 }).map(() =>
      request(app.getHttpServer())
        .post(`/v1/communities/${communityId}/join`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send()
    );

    const results = await Promise.all(joinPromises);

    // All requests should succeed with 200 OK
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    }

    // Check DB: exactly 1 membership row for this user
    const memberRows = await databaseService.client
      .select()
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, member.userId)
        )
      );

    expect(memberRows.length).toBe(1);
    expect(memberRows[0]!.status).toBe('ACTIVE');
  });

  it('10 simultaneous identical reactions -> exactly 1 reaction row (idempotent)', async () => {
    const author = await createActiveUser('post_author');
    const reactor = await createActiveUser('reactor');

    const postRes = await request(app.getHttpServer())
      .post('/v1/social/posts')
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({
        content: 'Concurrency post test',
        visibility: 'PUBLIC',
      });
    expect(postRes.status).toBe(201);
    const postId = postRes.body.data.id;

    // Fire 10 simultaneous reaction requests
    const reactionPromises = Array.from({ length: 10 }).map(() =>
      request(app.getHttpServer())
        .post(`/v1/social/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${reactor.accessToken}`)
        .send({ reactionType: 'LIKE' })
    );

    const results = await Promise.all(reactionPromises);

    // All should succeed with 200 OK
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(true);
    }

    // Check DB: exactly 1 reaction row
    const reactionRows = await databaseService.client
      .select()
      .from(postReactions)
      .where(
        and(
          eq(postReactions.postId, postId),
          eq(postReactions.userId, reactor.userId),
          eq(postReactions.reactionType, 'LIKE')
        )
      );

    expect(reactionRows.length).toBe(1);
  });

  it('10 simultaneous RSVP requests for 1 remaining seat -> exactly 1 GOING, 9 WAITLISTED (0 overbooking)', async () => {
    const organizer = await createActiveUser('event_organizer');

    // Event capacity 2: Organizer automatically occupies 1 seat, so remaining capacity is 1
    const eventRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        title: 'Micro Meetup 1 Seat Left',
        description: 'Only 1 additional guest allowed',
        type: 'PHYSICAL',
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 90000000).toISOString(),
        locationName: 'Secret Clubhouse',
        locationAddress: 'Secret Bunker 42',
        capacity: 2,
      });
    expect(eventRes.status).toBe(201);
    const eventId = eventRes.body.data.id;

    // Create 10 distinct users
    const racers = await Promise.all(
      Array.from({ length: 10 }).map((_, idx) => createActiveUser(`racer_${idx}`))
    );

    // Fire 10 simultaneous RSVP requests for GOING
    const rsvpPromises = racers.map((user) =>
      request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: 'GOING' })
    );

    const results = await Promise.all(rsvpPromises);

    const goingResults = results.filter((r) => r.status === 200 && r.body.data.status === 'GOING');
    const waitlistedResults = results.filter(
      (r) => r.status === 200 && r.body.data.status === 'WAITLISTED'
    );

    // Exactly 1 winner gets GOING, 9 get WAITLISTED
    expect(goingResults.length).toBe(1);
    expect(waitlistedResults.length).toBe(9);

    // Check DB: total GOING RSVPs is exactly 2 (organizer + winner) -> 0 overbooking!
    const goingRows = await databaseService.client
      .select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, 'GOING')));
    expect(goingRows.length).toBe(2);

    // Total WAITLISTED in DB is exactly 9
    const waitlistedRows = await databaseService.client
      .select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, 'WAITLISTED')));
    expect(waitlistedRows.length).toBe(9);

    // Verify all have valid created_at timestamps for deterministic FIFO ordering
    for (const row of waitlistedRows) {
      expect(row.createdAt).toBeInstanceOf(Date);
    }
  });

  it('handles concurrent RSVP cancellation + waitlist promotion deterministically', async () => {
    const organizer = await createActiveUser('cancel_org');
    const attendeeA = await createActiveUser('attendee_a');
    const attendeeB = await createActiveUser('attendee_b');
    const newAttendeeC = await createActiveUser('attendee_c');

    // Capacity 2 (organizer + 1)
    const eventRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Authorization', `Bearer ${organizer.accessToken}`)
      .send({
        title: 'Promotion Race Event',
        description: 'Waitlist promotion testing',
        type: 'PHYSICAL',
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 90000000).toISOString(),
        locationName: 'Secret Clubhouse',
        locationAddress: 'Room 101',
        capacity: 2,
      });
    const eventId = eventRes.body.data.id;

    // Attendee A RSVPs -> GOING
    const rsvpA = await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${attendeeA.accessToken}`)
      .send({ status: 'GOING' });
    expect(rsvpA.body.data.status).toBe('GOING');

    // Attendee B RSVPs -> WAITLISTED (position 1)
    const rsvpB = await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${attendeeB.accessToken}`)
      .send({ status: 'GOING' });
    expect(rsvpB.body.data.status).toBe('WAITLISTED');

    // Concurrently: Attendee A cancels, Attendee C attempts to RSVP GOING
    const [cancelResult, rsvpCResult] = await Promise.all([
      request(app.getHttpServer())
        .delete(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${attendeeA.accessToken}`),
      request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${newAttendeeC.accessToken}`)
        .send({ status: 'GOING' }),
    ]);

    expect(cancelResult.status).toBe(200);
    expect(rsvpCResult.status).toBe(200);

    // Check DB state:
    // Attendee B must have been promoted to GOING because they were next in FIFO queue
    const rsvpBRow = await databaseService.client
      .select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, attendeeB.userId)));
    expect(rsvpBRow[0]!.status).toBe('GOING');

    // Total confirmed going attendees must NOT exceed capacity (capacity = 2)
    const allGoing = await databaseService.client
      .select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, 'GOING')));
    expect(allGoing.length).toBe(2); // Organizer + Attendee B
  });

  it('handles concurrent post deletion and comment creation without foreign key or server crash', async () => {
    const author = await createActiveUser('post_deleter');
    const commenter = await createActiveUser('commenter');

    const postRes = await request(app.getHttpServer())
      .post('/v1/social/posts')
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({
        content: 'Post to be deleted concurrently',
        visibility: 'PUBLIC',
      });
    const postId = postRes.body.data.id;

    // Concurrently delete post and add comment
    const [delRes, commentRes] = await Promise.all([
      request(app.getHttpServer())
        .delete(`/v1/social/posts/${postId}`)
        .set('Authorization', `Bearer ${author.accessToken}`),
      request(app.getHttpServer())
        .post(`/v1/social/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${commenter.accessToken}`)
        .send({ content: 'Nice post!' }),
    ]);

    expect(delRes.status).toBe(200);
    // Comment either succeeded before deletion (201) or was rejected with 404 (post not found/available)
    expect([201, 404]).toContain(commentRes.status);

    // Post in DB is marked DELETED
    const postRow = await databaseService.client.select().from(posts).where(eq(posts.id, postId));
    expect(postRow[0]!.deletedAt).not.toBeNull();
  });

  it('handles concurrent community ban and member interaction safely', async () => {
    const owner = await createActiveUser('ban_comm_owner');
    const member = await createActiveUser('ban_comm_member');

    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const commRes = await request(app.getHttpServer())
      .post('/v1/communities')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: `Ban Concurrency ${randomSuffix}`,
        description: 'Testing concurrent ban',
        privacy: 'PUBLIC',
      });
    const communityId = commRes.body.data.id;

    // Member joins first
    await request(app.getHttpServer())
      .post(`/v1/communities/${communityId}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`);

    // Concurrently: Owner bans member, Member tries to leave
    const [banRes, leaveRes] = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/communities/${communityId}/members/${member.userId}/ban`)
        .set('Authorization', `Bearer ${owner.accessToken}`),
      request(app.getHttpServer())
        .delete(`/v1/communities/${communityId}/leave`)
        .set('Authorization', `Bearer ${member.accessToken}`),
    ]);

    expect(banRes.status).toBe(200);
    // Leave response is either 200 or 400 (if ban executed first and member already marked BANNED)
    expect([200, 400]).toContain(leaveRes.status);

    // Final member status in DB is either BANNED or LEFT, never corrupt
    const finalMember = await databaseService.client
      .select()
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, member.userId)
        )
      );
    expect(['BANNED', 'LEFT']).toContain(finalMember[0]!.status);
  });
});
