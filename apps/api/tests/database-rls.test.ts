import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { createTestApp } from './test-app.helper.js';
import { DatabaseService } from '../src/infrastructure/database/database.service.js';
import {
  users,
  profiles,
  sessions,
  notifications,
  matches,
  conversations,
  messages,
} from '../src/infrastructure/database/drizzle/schema/index.js';
import { generateUuidV7 } from '@platform/domain';

describe('SEC-06: PostgreSQL Row-Level Security (RLS) Multi-Tenant Isolation', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;

  const userAId = generateUuidV7();
  const userBId = generateUuidV7();
  const userCId = generateUuidV7();

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    databaseService = app.get(DatabaseService);

    // Seed test users
    await databaseService.client.insert(users).values([
      { id: userAId, email: `rls_a_${userAId}@example.com`, status: 'ACTIVE' },
      { id: userBId, email: `rls_b_${userBId}@example.com`, status: 'ACTIVE' },
      { id: userCId, email: `rls_c_${userCId}@example.com`, status: 'ACTIVE' },
    ]);

    // Seed profiles
    await databaseService.client.insert(profiles).values([
      {
        id: generateUuidV7(),
        userId: userAId,
        displayName: 'Alice',
        gender: 'WOMAN',
        dateOfBirth: '1995-01-01',
        completionStatus: { percentage: 100, missingRequired: [], recommended: [] } as any,
      },
      {
        id: generateUuidV7(),
        userId: userBId,
        displayName: 'Bob',
        gender: 'MAN',
        dateOfBirth: '1994-01-01',
        completionStatus: { percentage: 100, missingRequired: [], recommended: [] } as any,
      },
      {
        id: generateUuidV7(),
        userId: userCId,
        displayName: 'Charlie',
        gender: 'MAN',
        dateOfBirth: '1993-01-01',
        completionStatus: { percentage: 100, missingRequired: [], recommended: [] } as any,
      },
    ]);

    // Seed sessions
    await databaseService.client.insert(sessions).values([
      {
        id: generateUuidV7(),
        userId: userAId,
        tokenHash: 'hash_a',
        expiresAt: new Date(Date.now() + 86400000),
      },
      {
        id: generateUuidV7(),
        userId: userBId,
        tokenHash: 'hash_b',
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);

    // Seed private notification for User B
    await databaseService.client.insert(notifications).values({
      id: generateUuidV7(),
      userId: userBId,
      type: 'SECURITY_ALERT',
      title: 'Secret Alert for Bob',
      body: 'Sensitive personal notice',
    });

    // Seed match & conversation between User A and User B
    const matchId = generateUuidV7();
    const sortedA = userAId < userBId ? userAId : userBId;
    const sortedB = userAId < userBId ? userBId : userAId;

    await databaseService.client.insert(matches).values({
      id: matchId,
      userAId: sortedA,
      userBId: sortedB,
      status: 'ACTIVE',
    });

    const convId = generateUuidV7();
    await databaseService.client.insert(conversations).values({
      id: convId,
      matchId,
      status: 'ACTIVE',
    });

    await databaseService.client.insert(messages).values({
      id: generateUuidV7(),
      conversationId: convId,
      senderUserId: userAId,
      clientMessageId: `msg_${generateUuidV7()}`,
      body: 'Secret message between Alice and Bob',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows system/worker queries without user context to access all records', async () => {
    const allSessions = await databaseService.client.select().from(sessions);
    expect(allSessions.length).toBeGreaterThanOrEqual(2);
  });

  it('restricts session visibility strictly to the authenticated user under RLS', async () => {
    // Under User A context: can ONLY see User A sessions
    const aliceSessions = await databaseService.withUserContext(userAId, async (tx) => {
      return tx.select().from(sessions);
    });

    expect(aliceSessions.length).toBe(1);
    expect(aliceSessions[0]?.userId).toBe(userAId);

    // Under User B context: can ONLY see User B sessions
    const bobSessions = await databaseService.withUserContext(userBId, async (tx) => {
      return tx.select().from(sessions);
    });

    expect(bobSessions.length).toBe(1);
    expect(bobSessions[0]?.userId).toBe(userBId);
  });

  it('prevents cross-tenant query of private notifications', async () => {
    // Alice queries notifications table: Bob's notification is invisible
    const aliceNotifications = await databaseService.withUserContext(userAId, async (tx) => {
      return tx.select().from(notifications).where(eq(notifications.userId, userBId));
    });

    expect(aliceNotifications).toHaveLength(0);

    // Bob queries his own notifications: finds his notification
    const bobNotifications = await databaseService.withUserContext(userBId, async (tx) => {
      return tx.select().from(notifications).where(eq(notifications.userId, userBId));
    });

    expect(bobNotifications).toHaveLength(1);
    expect(bobNotifications[0]?.title).toBe('Secret Alert for Bob');
  });

  it('isolates conversation and message records from third-party users', async () => {
    // Charlie (userC) is NOT in the conversation between Alice and Bob
    const charlieConversations = await databaseService.withUserContext(userCId, async (tx) => {
      return tx.select().from(conversations);
    });

    expect(charlieConversations).toHaveLength(0);

    const charlieMessages = await databaseService.withUserContext(userCId, async (tx) => {
      return tx.select().from(messages);
    });

    expect(charlieMessages).toHaveLength(0);

    // Alice is a participant in the conversation: sees conversation and messages
    const aliceConversations = await databaseService.withUserContext(userAId, async (tx) => {
      return tx.select().from(conversations);
    });

    expect(aliceConversations).toHaveLength(1);

    const aliceMessages = await databaseService.withUserContext(userAId, async (tx) => {
      return tx.select().from(messages);
    });

    expect(aliceMessages).toHaveLength(1);
    expect(aliceMessages[0]?.body).toBe('Secret message between Alice and Bob');
  });

  it('prevents cross-tenant mutations under user context', async () => {
    // Alice attempts to update Bob's profile
    const updateResult = await databaseService.withUserContext(userAId, async (tx) => {
      return tx
        .update(profiles)
        .set({ displayName: 'Hacked by Alice' })
        .where(eq(profiles.userId, userBId));
    });

    // Bob's profile remains unmodified
    const [bobProfile] = await databaseService.client
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userBId));

    expect(bobProfile?.displayName).toBe('Bob');
  });

  it('allows admin bypass with app.is_admin = true even when user context is set', async () => {
    const adminSeenSessions = await databaseService.db.transaction(async (tx: any) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE nazar_app_role;`));
      await tx.execute(sql.raw(`SET LOCAL app.current_user_id = '${userAId}';`));
      await tx.execute(sql`SET LOCAL app.is_admin = 'true';`);
      return tx.select().from(sessions);
    });

    expect(adminSeenSessions.length).toBeGreaterThanOrEqual(2);
  });
});
