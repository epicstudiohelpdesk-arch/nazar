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
  outboxEvents,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';
import { eq, and } from 'drizzle-orm';

describe('Events, Capacity & RSVP Engine (Gate 12)', () => {
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
      dateOfBirth: '1993-11-10',
      gender: 'MAN',
      city: 'Bengaluru',
      countryCode: 'IN',
      visibility: 'ACTIVE',
      completionStatus: { percentage: 100, missingRequired: [], recommended: [] },
    });

    return { userId, accessToken };
  }

  describe('Event Creation & Date / Capacity Validation', () => {
    it('creates an event with organizer as GOING and validates date ordering', async () => {
      const organizer = await createActiveUser('event_org');

      // Invalid date ordering
      const invalidDate = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${organizer.accessToken}`)
        .send({
          title: 'Invalid Date Event',
          description: 'Testing end time before start time',
          type: 'PHYSICAL',
          startAt: '2026-11-10T15:00:00.000Z',
          endAt: '2026-11-10T14:00:00.000Z',
          locationName: 'Indiranagar Social',
        });

      expect(invalidDate.status).toBe(400);
      expect(invalidDate.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);

      // Valid event
      const validEvent = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${organizer.accessToken}`)
        .send({
          title: 'Indiranagar Tech Mixer',
          description: 'Casual networking for tech professionals',
          type: 'PHYSICAL',
          startAt: '2026-11-10T18:00:00.000Z',
          endAt: '2026-11-10T21:00:00.000Z',
          locationName: 'Indiranagar Social, 100ft Road',
          locationAddress: 'Plot 45, 100 Feet Rd, HAL 2nd Stage',
          capacity: 30,
        });

      expect(validEvent.status).toBe(201);
      expect(validEvent.body.data.attendeeCount).toBe(1);
      expect(validEvent.body.data.currentUserRsvp).toBe('GOING');
    });

    it('enforces PREMIUM entitlement for large events (>50 capacity)', async () => {
      const user = await createActiveUser('large_event_org');

      // Attempt > 50 capacity without PREMIUM
      const failRes = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          title: 'Huge Conference',
          description: 'Large conference for 200 people',
          type: 'PHYSICAL',
          startAt: '2026-11-15T09:00:00.000Z',
          endAt: '2026-11-15T18:00:00.000Z',
          locationName: 'Convention Center',
          capacity: 200,
        });

      expect(failRes.status).toBe(403);
      expect(failRes.body.error.code).toBe(ErrorCode.ENTITLEMENT_REQUIRED);

      // Grant PREMIUM
      await databaseService.client.insert(entitlements).values({
        id: generateUuidV7(),
        userId: user.userId,
        entitlementCode: 'PREMIUM',
        sourceType: 'SUBSCRIPTION',
        status: 'ACTIVE',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Succeeds with PREMIUM
      const okRes = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          title: 'Huge Conference',
          description: 'Large conference for 200 people',
          type: 'PHYSICAL',
          startAt: '2026-11-15T09:00:00.000Z',
          endAt: '2026-11-15T18:00:00.000Z',
          locationName: 'Convention Center',
          capacity: 200,
        });

      expect(okRes.status).toBe(201);
      expect(okRes.body.data.capacity).toBe(200);
    });
  });

  describe('Location Privacy Enforcement', () => {
    it('reveals exact address only to organizer and confirmed GOING attendees', async () => {
      const organizer = await createActiveUser('privacy_org');
      const attendee = await createActiveUser('privacy_attendee');
      const outsider = await createActiveUser('privacy_outsider');

      const createRes = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${organizer.accessToken}`)
        .send({
          title: 'Private Rooftop Dinner',
          description: 'Intimate dinner party',
          type: 'PHYSICAL',
          startAt: '2026-12-01T19:00:00.000Z',
          endAt: '2026-12-01T22:00:00.000Z',
          locationName: 'Secret Penthouse, Koramangala',
          locationAddress: 'Flat 402, Signature Towers, 5th Block Koramangala',
          locationUrl: 'https://maps.google.com/?q=secret',
          capacity: 10,
        });
      const eventId = createRes.body.data.id as string;

      // 1. Outsider sees approximate locationName, but locationAddress & url are null
      const outsiderView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(outsiderView.status).toBe(200);
      expect(outsiderView.body.data.locationName).toBe('Secret Penthouse, Koramangala');
      expect(outsiderView.body.data.locationAddress).toBeNull();
      expect(outsiderView.body.data.locationUrl).toBeNull();

      // 2. Attendee RSVPs GOING
      await request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'GOING' });

      // 3. Attendee now sees exact locationAddress and locationUrl
      const attendeeView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${attendee.accessToken}`);

      expect(attendeeView.status).toBe(200);
      expect(attendeeView.body.data.locationAddress).toBe(
        'Flat 402, Signature Towers, 5th Block Koramangala'
      );
      expect(attendeeView.body.data.locationUrl).toBe('https://maps.google.com/?q=secret');

      // 4. Organizer always sees exact location
      const orgView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${organizer.accessToken}`);

      expect(orgView.status).toBe(200);
      expect(orgView.body.data.locationAddress).toBe(
        'Flat 402, Signature Towers, 5th Block Koramangala'
      );
    });

    it('redacts precise coordinates alongside the address they belong to', async () => {
      // Coordinates identify a venue as precisely as a street address does, so
      // leaving them visible would defeat the address redaction entirely.
      const organizer = await createActiveUser('coords_org');
      const attendee = await createActiveUser('coords_attendee');
      const outsider = await createActiveUser('coords_outsider');

      const createRes = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${organizer.accessToken}`)
        .send({
          title: 'Laneway Photo Walk',
          description: 'Shooting the old city alleys at golden hour',
          type: 'PHYSICAL',
          startAt: '2026-12-08T16:00:00.000Z',
          endAt: '2026-12-08T19:00:00.000Z',
          locationName: 'KR Market, Gate 1',
          locationAddress: 'Kalasipalya Road, Bengaluru 560002',
          locationUrl: 'https://maps.google.com/?q=kr-market',
          latitude: 12.9591,
          longitude: 77.6764,
          capacity: 25,
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.data.id as string;

      // 1. The organizer, who is auto-RSVP'd GOING, keeps the coordinates.
      const orgView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${organizer.accessToken}`);
      expect(orgView.body.data.latitude).toBe(12.9591);
      expect(orgView.body.data.longitude).toBe(77.6764);

      // 2. An outsider gets the coarse name and nothing that pins the venue down.
      const outsiderView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);
      expect(outsiderView.status).toBe(200);
      expect(outsiderView.body.data.locationName).toBe('KR Market, Gate 1');
      expect(outsiderView.body.data.locationAddress).toBeNull();
      expect(outsiderView.body.data.latitude).toBeNull();
      expect(outsiderView.body.data.longitude).toBeNull();

      // 3. The discovery list must not leak what the detail view withholds. The
      // list is ordered by `startAt ASC` and the test database accumulates events
      // across runs, so the event is found by walking the cursor rather than by
      // assuming it is on the first page.
      let outsiderListItem: Record<string, unknown> | undefined;
      let cursor: string | null = null;
      for (let page = 0; page < 10 && !outsiderListItem; page += 1) {
        const res: request.Response = await request(app.getHttpServer())
          .get(`/v1/events?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
          .set('Authorization', `Bearer ${outsider.accessToken}`);
        expect(res.status).toBe(200);
        outsiderListItem = res.body.data.items.find(
          (e: { id: string }) => e.id === eventId
        );
        cursor = res.body.data.nextCursor ?? null;
      }
      expect(outsiderListItem).toBeDefined();
      expect(outsiderListItem?.locationAddress).toBeNull();
      expect(outsiderListItem?.latitude).toBeNull();
      expect(outsiderListItem?.longitude).toBeNull();

      // 4. INTERESTED is not a confirmed place, so it must not unlock the address.
      await request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'INTERESTED' });

      const interestedView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${attendee.accessToken}`);
      expect(interestedView.body.data.currentUserRsvp).toBe('INTERESTED');
      expect(interestedView.body.data.locationAddress).toBeNull();
      expect(interestedView.body.data.latitude).toBeNull();
      expect(interestedView.body.data.longitude).toBeNull();

      // 5. Only a confirmed GOING attendee sees the exact coordinates.
      await request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'GOING' });

      const attendeeView = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${attendee.accessToken}`);
      expect(attendeeView.body.data.latitude).toBe(12.9591);
      expect(attendeeView.body.data.longitude).toBe(77.6764);
    });
  });

  describe('Capacity Enforcement & Deterministic FIFO Waitlist Promotion', () => {
    it('manages capacity, waitlists overflow, and promotes FIFO on cancellation', async () => {
      const organizer = await createActiveUser('fifo_org');
      const userA = await createActiveUser('fifo_user_a');
      const userB = await createActiveUser('fifo_user_b');

      // Create event with capacity = 2 (Organizer is 1, so exactly 1 remaining seat!)
      const createRes = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${organizer.accessToken}`)
        .send({
          title: '2-Person Exclusive Workshop',
          description: 'Organizer + 1 participant',
          type: 'PHYSICAL',
          startAt: '2026-11-20T10:00:00.000Z',
          endAt: '2026-11-20T12:00:00.000Z',
          locationName: 'Studio 1',
          capacity: 2,
          isWaitlistEnabled: true,
        });
      const eventId = createRes.body.data.id as string;

      // 1. User A RSVPs GOING -> Succeeded (fills the 2nd seat)
      const rsvpA = await request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ status: 'GOING' });

      expect(rsvpA.status).toBe(200);
      expect(rsvpA.body.data.status).toBe('GOING');

      let event = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${organizer.accessToken}`);
      expect(event.body.data.attendeeCount).toBe(2);
      expect(event.body.data.waitlistCount).toBe(0);

      // 2. User B RSVPs GOING -> Capacity reached -> Placed on WAITLISTED
      const rsvpB = await request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ status: 'GOING' });

      expect(rsvpB.status).toBe(200);
      expect(rsvpB.body.data.status).toBe('WAITLISTED');

      event = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${organizer.accessToken}`);
      expect(event.body.data.attendeeCount).toBe(2);
      expect(event.body.data.waitlistCount).toBe(1);

      // 3. User A cancels their RSVP -> Frees a seat -> User B automatically promoted FIFO!
      const cancelA = await request(app.getHttpServer())
        .delete(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${userA.accessToken}`);

      expect(cancelA.status).toBe(200);
      expect(cancelA.body.data.success).toBe(true);

      // Verify User B's status is now GOING
      const checkB = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`);

      expect(checkB.body.data.currentUserRsvp).toBe('GOING');
      expect(checkB.body.data.attendeeCount).toBe(2);
      expect(checkB.body.data.waitlistCount).toBe(0);

      // Verify outbox event 'event.waitlist_promoted' was written for User B
      const promotedEvents = await databaseService.client
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.eventType, 'event.waitlist_promoted'),
            eq(outboxEvents.aggregateId, eventId)
          )
        );

      expect(promotedEvents.length).toBeGreaterThan(0);
      const payload = promotedEvents[0]?.payload as { userId: string };
      expect(payload.userId).toBe(userB.userId);
    });
  });

  describe('Event Cancellation Lifecycle', () => {
    it('cancelling event marks status CANCELLED and blocks further RSVPs', async () => {
      const organizer = await createActiveUser('cancel_org');
      const attendee = await createActiveUser('cancel_attendee');

      const createRes = await request(app.getHttpServer())
        .post('/v1/events')
        .set('Authorization', `Bearer ${organizer.accessToken}`)
        .send({
          title: 'Outdoor Marathon',
          description: 'City marathon',
          type: 'PHYSICAL',
          startAt: '2026-11-25T06:00:00.000Z',
          endAt: '2026-11-25T11:00:00.000Z',
          locationName: 'Kanteerava Stadium',
        });
      const eventId = createRes.body.data.id as string;

      // Organizer cancels the event
      const cancelRes = await request(app.getHttpServer())
        .delete(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${organizer.accessToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.success).toBe(true);

      // Event status is CANCELLED
      const event = await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${organizer.accessToken}`);
      expect(event.body.data.status).toBe('CANCELLED');

      // Attempting to RSVP to cancelled event fails
      const rsvpAttempt = await request(app.getHttpServer())
        .post(`/v1/events/${eventId}/rsvp`)
        .set('Authorization', `Bearer ${attendee.accessToken}`)
        .send({ status: 'GOING' });

      expect(rsvpAttempt.status).toBe(400);
      expect(rsvpAttempt.body.error.code).toBe(ErrorCode.EVENT_CANCELLED);
    });
  });
});
