import { sql, inArray, like } from 'drizzle-orm';
import type { DrizzleDatabase } from '../drizzle/client.js';
import { generateUuidV7 } from '@platform/domain';
import { users } from '../drizzle/schema/users.js';
import { userIdentities } from '../drizzle/schema/user-identities.js';
import { profiles } from '../drizzle/schema/profiles.js';
import { profilePreferences } from '../drizzle/schema/profile-preferences.js';
import { interests } from '../drizzle/schema/interests.js';
import { profileInterests } from '../drizzle/schema/profile-interests.js';
import { userInteractions } from '../drizzle/schema/interactions.js';
import { matches } from '../drizzle/schema/matches.js';
import { conversations } from '../drizzle/schema/conversations.js';
import { messages } from '../drizzle/schema/messages.js';
import { communities, communityMemberships } from '../drizzle/schema/communities.js';
import { events, eventRsvps } from '../drizzle/schema/events.js';
import { posts, postComments } from '../drizzle/schema/posts.js';
import { userRecommendationFeatures } from '../drizzle/schema/recommendations.js';
import { analyticsEvents } from '../drizzle/schema/analytics.js';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';

export const PERF_EMAIL_DOMAIN = 'perf.nazar.test';

export interface MetroClusterConfig {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  size: number;
}

export const DEFAULT_METRO_CLUSTERS: MetroClusterConfig[] = [
  { name: 'London', lat: 51.5074, lng: -0.1278, radiusKm: 25, size: 80 },
  { name: 'Istanbul', lat: 41.0082, lng: 28.9784, radiusKm: 30, size: 60 },
  { name: 'NewYork', lat: 40.7128, lng: -74.006, radiusKm: 20, size: 60 },
];

export interface PerfDatasetResult {
  totalUsers: number;
  userMapByCluster: Record<string, string[]>;
  userIds: string[];
  matchIds: string[];
  conversationIds: string[];
  communityIds: string[];
  eventIds: string[];
}

/** Simple linear congruential generator for reproducible synthetic generation */
function createSeededRandom(seed = 133742) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function seedPerfDataset(
  db: DrizzleDatabase,
  clusters: MetroClusterConfig[] = DEFAULT_METRO_CLUSTERS
): Promise<PerfDatasetResult> {
  const rand = createSeededRandom(429496);

  // Check or ensure base interests exist
  const existingInterests = await db.select().from(interests).limit(10);
  let availableInterestIds = existingInterests.map((i) => i.id);

  if (availableInterestIds.length === 0) {
    const demoInterests = [
      { id: generateUuidV7(), name: 'Travel', slug: 'travel', category: 'LIFESTYLE' },
      { id: generateUuidV7(), name: 'Architecture', slug: 'architecture', category: 'ARTS' },
      { id: generateUuidV7(), name: 'Cinema', slug: 'cinema', category: 'ENTERTAINMENT' },
      { id: generateUuidV7(), name: 'Coffee', slug: 'coffee', category: 'FOOD' },
      { id: generateUuidV7(), name: 'Fitness', slug: 'fitness', category: 'SPORTS' },
    ];
    await db.insert(interests).values(demoInterests);
    availableInterestIds = demoInterests.map((i) => i.id);
  }

  const result: PerfDatasetResult = {
    totalUsers: 0,
    userMapByCluster: {},
    userIds: [],
    matchIds: [],
    conversationIds: [],
    communityIds: [],
    eventIds: [],
  };

  const allUsersToInsert: (typeof users.$inferInsert)[] = [];
  const allIdentitiesToInsert: (typeof userIdentities.$inferInsert)[] = [];
  const allProfilesToInsert: (typeof profiles.$inferInsert)[] = [];
  const allPrefsToInsert: (typeof profilePreferences.$inferInsert)[] = [];
  const allInterestsToInsert: (typeof profileInterests.$inferInsert)[] = [];
  const allFeaturesToInsert: (typeof userRecommendationFeatures.$inferInsert)[] = [];

  let userCounter = 0;

  for (const cluster of clusters) {
    const clusterUserIds: string[] = [];

    for (let i = 0; i < cluster.size; i++) {
      userCounter++;
      const userId = generateUuidV7();
      const profileId = generateUuidV7();
      clusterUserIds.push(userId);
      result.userIds.push(userId);

      // Skewed coordinate generation around cluster center
      // 1 degree latitude ~ 111km; 1 degree longitude ~ 111km * cos(lat)
      const angle = rand() * 2 * Math.PI;
      const distKm = Math.sqrt(rand()) * cluster.radiusKm;
      const deltaLat = (distKm / 111) * Math.sin(angle);
      const deltaLng = (distKm / (111 * Math.cos((cluster.lat * Math.PI) / 180))) * Math.cos(angle);
      const lat = Number((cluster.lat + deltaLat).toFixed(6));
      const lng = Number((cluster.lng + deltaLng).toFixed(6));

      // Realistic age skew (centered around 26)
      const age = Math.floor(20 + rand() * 15);
      const birthYear = 2026 - age;
      const birthMonth = String(1 + Math.floor(rand() * 12)).padStart(2, '0');
      const birthDay = String(1 + Math.floor(rand() * 28)).padStart(2, '0');
      const dateOfBirth = `${birthYear}-${birthMonth}-${birthDay}`;

      const gender: Gender = rand() > 0.5 ? 'WOMAN' : rand() > 0.1 ? 'MAN' : 'NON_BINARY';
      const seekingGenders: Gender[] =
        gender === 'WOMAN' ? ['MAN'] : gender === 'MAN' ? ['WOMAN'] : ['MAN', 'WOMAN'];

      const email = `perf_${cluster.name.toLowerCase()}_${userCounter}@${PERF_EMAIL_DOMAIN}`;

      allUsersToInsert.push({
        id: userId,
        status: 'ACTIVE',
      });

      allIdentitiesToInsert.push({
        id: generateUuidV7(),
        userId,
        provider: 'EMAIL',
        providerSubject: email,
        email,
        emailVerified: true,
      });

      allProfilesToInsert.push({
        id: profileId,
        userId,
        displayName: `${cluster.name} User ${userCounter}`,
        dateOfBirth,
        gender,
        bio: `Synthetic load-testing profile located in ${cluster.name}. Interested in high-concurrency systems.`,
        occupation: 'Software Engineer',
        city: cluster.name,
        countryCode: cluster.name === 'London' ? 'GB' : cluster.name === 'Istanbul' ? 'TR' : 'US',
        latitude: lat,
        longitude: lng,
        location: { longitude: lng, latitude: lat },
        visibility: 'ACTIVE',
        completionStatus: {
          percentage: 100,
          missingRequired: [],
          recommended: [],
        },
      });

      allPrefsToInsert.push({
        id: generateUuidV7(),
        userId,
        minAge: Math.max(18, age - 5),
        maxAge: age + 8,
        genderPreferences: seekingGenders,
        maxDistanceKm: Math.floor(25 + rand() * 50),
        relationshipIntent: 'LONG_TERM' as RelationshipIntent,
      });

      // Link 2-3 random interests
      const assignedInterestIds = availableInterestIds.slice(0, 3);
      for (const intId of assignedInterestIds) {
        allInterestsToInsert.push({
          id: generateUuidV7(),
          profileId,
          interestId: intId,
        });
      }

      // Precomputed recommendation features
      allFeaturesToInsert.push({
        userId,
        featureVersion: 'v1',
        features: {
          activityScore: Number((0.5 + rand() * 0.5).toFixed(3)),
          profileQualityScore: Number((0.7 + rand() * 0.3).toFixed(3)),
          swipeRatio: Number((0.2 + rand() * 0.4).toFixed(3)),
          incomingLikesCount: Math.floor(rand() * 50),
          outgoingLikesCount: Math.floor(rand() * 100),
          lastActiveHoursAgo: Math.floor(rand() * 48),
        },
      });
    }

    result.userMapByCluster[cluster.name] = clusterUserIds;
    result.totalUsers += clusterUserIds.length;
  }

  // Chunked batch insertions for users and profiles
  const CHUNK_SIZE = 100;
  for (let i = 0; i < allUsersToInsert.length; i += CHUNK_SIZE) {
    await db.insert(users).values(allUsersToInsert.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < allIdentitiesToInsert.length; i += CHUNK_SIZE) {
    await db.insert(userIdentities).values(allIdentitiesToInsert.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < allProfilesToInsert.length; i += CHUNK_SIZE) {
    await db.insert(profiles).values(allProfilesToInsert.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < allPrefsToInsert.length; i += CHUNK_SIZE) {
    await db.insert(profilePreferences).values(allPrefsToInsert.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < allInterestsToInsert.length; i += CHUNK_SIZE) {
    await db.insert(profileInterests).values(allInterestsToInsert.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < allFeaturesToInsert.length; i += CHUNK_SIZE) {
    await db
      .insert(userRecommendationFeatures)
      .values(allFeaturesToInsert.slice(i, i + CHUNK_SIZE));
  }

  // Generate pre-existing Interactions and Canonical Matches within clusters
  const allInteractions: (typeof userInteractions.$inferInsert)[] = [];
  const allMatches: (typeof matches.$inferInsert)[] = [];
  const allConversations: (typeof conversations.$inferInsert)[] = [];
  const allMessages: (typeof messages.$inferInsert)[] = [];

  for (const cluster of clusters) {
    const uids = result.userMapByCluster[cluster.name];
    if (uids && uids.length >= 10) {
      // Create cross-interactions for first 20 users
      for (let i = 0; i < Math.min(20, uids.length); i++) {
        for (let j = i + 1; j < Math.min(20, uids.length); j++) {
          const userA = uids[i];
          const userB = uids[j];
          if (!userA || !userB) continue;

          // Mutual like for adjacent pairs
          if (j === i + 1) {
            allInteractions.push({
              id: generateUuidV7(),
              actorUserId: userA,
              targetUserId: userB,
              type: 'LIKE',
            });
            allInteractions.push({
              id: generateUuidV7(),
              actorUserId: userB,
              targetUserId: userA,
              type: 'LIKE',
            });

            // Canonical match (ordered pair userA < userB)
            const [first, second] = userA < userB ? [userA, userB] : [userB, userA];
            const matchId = generateUuidV7();
            allMatches.push({
              id: matchId,
              userAId: first,
              userBId: second,
              status: 'ACTIVE',
            });
            result.matchIds.push(matchId);

            // Active conversation for this match
            const convId = generateUuidV7();
            allConversations.push({
              id: convId,
              matchId,
              status: 'ACTIVE',
            });
            result.conversationIds.push(convId);

            // Seed realistic messages in conversation
            for (let m = 1; m <= 5; m++) {
              allMessages.push({
                id: generateUuidV7(),
                conversationId: convId,
                senderUserId: m % 2 === 0 ? first : second,
                clientMessageId: `msg-${convId}-${m}`,
                messageType: 'TEXT',
                body: `Benchmark test message #${m} for conversation ${convId}`,
              });
            }
          } else if (j === i + 2) {
            // One-way like
            allInteractions.push({
              id: generateUuidV7(),
              actorUserId: userA,
              targetUserId: userB,
              type: 'LIKE',
            });
          } else if (j === i + 3) {
            // Pass
            allInteractions.push({
              id: generateUuidV7(),
              actorUserId: userA,
              targetUserId: userB,
              type: 'PASS',
            });
          }
        }
      }
    }
  }

  if (allInteractions.length > 0) {
    for (let i = 0; i < allInteractions.length; i += CHUNK_SIZE) {
      await db.insert(userInteractions).values(allInteractions.slice(i, i + CHUNK_SIZE));
    }
  }
  if (allMatches.length > 0) {
    for (let i = 0; i < allMatches.length; i += CHUNK_SIZE) {
      await db.insert(matches).values(allMatches.slice(i, i + CHUNK_SIZE));
    }
  }
  if (allConversations.length > 0) {
    for (let i = 0; i < allConversations.length; i += CHUNK_SIZE) {
      await db.insert(conversations).values(allConversations.slice(i, i + CHUNK_SIZE));
    }
  }
  if (allMessages.length > 0) {
    for (let i = 0; i < allMessages.length; i += CHUNK_SIZE) {
      await db.insert(messages).values(allMessages.slice(i, i + CHUNK_SIZE));
    }
  }

  // Communities, Events & Concurrency RSVP Targets
  const firstLondonUser = result.userMapByCluster['London']?.[0] || result.userIds[0];
  if (!firstLondonUser) {
    throw new Error('No valid London user found to create community');
  }
  const communityId = generateUuidV7();
  result.communityIds.push(communityId);

  await db.insert(communities).values({
    id: communityId,
    creatorId: firstLondonUser,
    name: 'London Performance Tech Club',
    slug: `london-perf-club-${Date.now()}`,
    description: 'High performance systems community in London.',
    privacy: 'PUBLIC',
    memberCount: 25,
  });

  // Add 15 members to this community
  const membersToInsert: (typeof communityMemberships.$inferInsert)[] = [];
  const londonUsers = result.userMapByCluster['London'] || [];
  for (let i = 0; i < Math.min(15, londonUsers.length); i++) {
    const uid = londonUsers[i];
    if (!uid) continue;
    membersToInsert.push({
      id: generateUuidV7(),
      communityId,
      userId: uid,
      role: i === 0 ? 'OWNER' : 'MEMBER',
      status: 'ACTIVE',
    });
  }
  await db.insert(communityMemberships).values(membersToInsert);

  // Create an event with tight capacity (capacity = 5) for RSVP concurrency stress tests
  const eventId = generateUuidV7();
  result.eventIds.push(eventId);
  await db.insert(events).values({
    id: eventId,
    organizerId: firstLondonUser,
    communityId,
    title: 'High-Concurrency Scaling Symposium',
    description: 'Exclusive event with strictly limited capacity for concurrency testing.',
    type: 'PHYSICAL',
    status: 'PUBLISHED',
    startAt: new Date(Date.now() + 86400000 * 7),
    endAt: new Date(Date.now() + 86400000 * 7 + 7200000),
    locationName: 'London Tech Hub',
    capacity: 5,
    attendeeCount: 3,
    waitlistCount: 0,
    isWaitlistEnabled: true,
  });

  // Pre-seed 3 confirmed RSVPs (leaving exactly 2 available spots for race tests)
  const rsvpsToInsert: (typeof eventRsvps.$inferInsert)[] = [];
  for (let i = 1; i <= 3; i++) {
    const uid = londonUsers[i];
    if (uid) {
      rsvpsToInsert.push({
        id: generateUuidV7(),
        eventId,
        userId: uid,
        status: 'GOING',
      });
    }
  }
  if (rsvpsToInsert.length > 0) {
    await db.insert(eventRsvps).values(rsvpsToInsert);
  }

  // Social Posts & Comments
  const post1Id = generateUuidV7();
  await db.insert(posts).values({
    id: post1Id,
    authorId: firstLondonUser,
    communityId,
    content: 'Welcome to the performance benchmark thread. Real-time stress validation underway!',
    visibility: 'PUBLIC',
    likeCount: 12,
    commentCount: 4,
  });

  const commentsToInsert: (typeof postComments.$inferInsert)[] = [];
  for (let c = 1; c <= 4; c++) {
    const uid = londonUsers[c];
    if (uid) {
      commentsToInsert.push({
        id: generateUuidV7(),
        postId: post1Id,
        authorId: uid,
        content: `Performance verification comment #${c}`,
      });
    }
  }
  if (commentsToInsert.length > 0) {
    await db.insert(postComments).values(commentsToInsert);
  }

  // Pre-seed batch analytics events
  const analyticsToInsert: (typeof analyticsEvents.$inferInsert)[] = [];
  for (let a = 0; a < 50; a++) {
    const actor = result.userIds[a % result.userIds.length];
    if (!actor) continue;
    analyticsToInsert.push({
      id: generateUuidV7(),
      eventName: 'perf.benchmark.action',
      eventVersion: 1,
      occurredAt: new Date(Date.now() - a * 60000),
      producer: 'server',
      actorUserId: actor,
      sessionId: `sess-perf-${a % 10}`,
      deviceId: `dev-perf-${a % 10}`,
      platform: 'backend',
      properties: { testRun: 'perf-benchmark', iteration: a, latencyMs: 12.4 + (a % 5) },
      privacyClass: 'INTERNAL',
      ingestionStatus: 'ACCEPTED',
    });
  }
  await db.insert(analyticsEvents).values(analyticsToInsert);

  return result;
}

export async function purgePerfDataset(
  db: DrizzleDatabase
): Promise<{ deletedUsers: number; deletedAnalytics: number }> {
  // Query all users belonging to PERF_EMAIL_DOMAIN via userIdentities
  const perfIdentities = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(like(userIdentities.email, `%@${PERF_EMAIL_DOMAIN}`));

  let userIds = perfIdentities.map((u) => u.userId);

  // Also query any profiles matching synthetic perf profile markers
  const perfProfiles = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(like(profiles.bio, 'Synthetic load-testing profile located in%'));

  const profileUserIds = perfProfiles.map((p) => p.userId);
  userIds = Array.from(new Set([...userIds, ...profileUserIds]));

  let deletedUsers = 0;
  if (userIds.length > 0) {
    // Delete in chunks to prevent large SQL parameter lists
    const CHUNK_SIZE = 100;
    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      await db.delete(users).where(inArray(users.id, chunk));
    }
    deletedUsers = userIds.length;
  }

  // Delete synthetic analytics events
  const deletedAnalyticsResult = await db
    .delete(analyticsEvents)
    .where(sql`${analyticsEvents.properties}->>'testRun' = 'perf-benchmark'`);

  const deletedAnalytics = (deletedAnalyticsResult as any)?.rowCount ?? 0;

  return { deletedUsers, deletedAnalytics };
}
