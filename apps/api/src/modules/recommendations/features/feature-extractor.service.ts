import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql, eq, and, or, gte } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  profiles,
  profileInterests,
  profilePrompts,
  profileMedia,
  userInteractions,
  matches,
  messages,
  posts,
  postComments,
  postReactions,
  communityMemberships,
  eventRsvps,
  recommendationExposures,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import type { UserFeatureVector } from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';

@Injectable()
export class FeatureExtractorService {
  private readonly logger = new Logger(FeatureExtractorService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  /**
   * Extract comprehensive feature vector for a specific user.
   */
  async extractFeatures(userId: string): Promise<UserFeatureVector> {
    const client = this.databaseService.client;

    // 1. Profile information
    const [profile] = await client
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : undefined;
    const completeness = profile?.completionStatus
      ? ((profile.completionStatus as { percentage?: number })?.percentage ?? 50)
      : 50;

    // 2. Profile components counts
    const [mediaCountRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(profileMedia)
      .where(and(eq(profileMedia.profileId, profile?.id || ''), eq(profileMedia.status, 'READY')));

    const [promptsCountRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(profilePrompts)
      .where(eq(profilePrompts.profileId, profile?.id || ''));

    const interestsRows = await client
      .select({ interestId: profileInterests.interestId })
      .from(profileInterests)
      .where(eq(profileInterests.profileId, profile?.id || ''));

    const interestIds = interestsRows.map((r) => r.interestId);

    // 3. Behavioral signals: Interactions & Matches
    const [likesSentRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(userInteractions)
      .where(and(eq(userInteractions.actorUserId, userId), eq(userInteractions.type, 'LIKE')));

    const [likesReceivedRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(userInteractions)
      .where(and(eq(userInteractions.targetUserId, userId), eq(userInteractions.type, 'LIKE')));

    const [passesSentRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(userInteractions)
      .where(and(eq(userInteractions.actorUserId, userId), eq(userInteractions.type, 'PASS')));

    const [matchesRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(or(eq(matches.userAId, userId), eq(matches.userBId, userId)));

    const likesSentCount = likesSentRow?.count ?? 0;
    const likesReceivedCount = likesReceivedRow?.count ?? 0;
    const passesCount = passesSentRow?.count ?? 0;
    const matchesCount = matchesRow?.count ?? 0;
    const matchRate = likesSentCount > 0 ? Number((matchesCount / likesSentCount).toFixed(4)) : 0;

    // 4. Communication signals: Messages & Conversations
    const [messagesSentRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.senderUserId, userId));

    const messagesSentCount = messagesSentRow?.count ?? 0;

    // Estimate received messages
    const messagesReceivedRes = await client.execute(sql`
      SELECT count(*)::int as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN matches match ON c.match_id = match.id
      WHERE (match.user_a_id = ${userId} OR match.user_b_id = ${userId})
        AND m.sender_user_id != ${userId}
    `);
    const messagesReceivedCount =
      Number(
        (messagesReceivedRes.rows?.[0] as { count?: number | string } | undefined)?.count ?? 0
      ) || 0;

    const replyRate =
      messagesReceivedCount > 0
        ? Math.min(1.0, Number((messagesSentCount / messagesReceivedCount).toFixed(4)))
        : 0.5;

    // 5. Social engagement signals
    const [postsRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, userId), sql`${posts.deletedAt} IS NULL`));

    const [commentsRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(postComments)
      .where(and(eq(postComments.authorId, userId), sql`${postComments.deletedAt} IS NULL`));

    const [reactionsRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(postReactions)
      .where(eq(postReactions.userId, userId));

    const [communitiesRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(communityMemberships)
      .where(
        and(eq(communityMemberships.userId, userId), eq(communityMemberships.status, 'ACTIVE'))
      );

    const [eventsRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.userId, userId), eq(eventRsvps.status, 'GOING')));

    // 6. Exposures in the last 72 hours
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const [exposuresRow] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(recommendationExposures)
      .where(
        and(
          eq(recommendationExposures.candidateUserId, userId),
          gte(recommendationExposures.surfacedAt, cutoff72h)
        )
      );

    const result: UserFeatureVector = {
      age,
      gender: profile?.gender,
      profileCompleteness: completeness,
      photosCount: mediaCountRow?.count ?? 0,
      promptsCount: promptsCountRow?.count ?? 0,
      interests: interestIds,
      likesSentCount,
      likesReceivedCount,
      passesCount,
      matchesCount,
      matchRate,
      messagesSentCount,
      messagesReceivedCount,
      replyRate,
      conversationsCount: matchesCount,
      postsCount: postsRow?.count ?? 0,
      commentsCount: commentsRow?.count ?? 0,
      reactionsCount: reactionsRow?.count ?? 0,
      communitiesCount: communitiesRow?.count ?? 0,
      eventsJoinedCount: eventsRow?.count ?? 0,
      lastActiveAt: profile?.updatedAt?.toISOString() || null,
      profileUpdatedAt: profile?.updatedAt?.toISOString() || null,
      recentExposureCount: exposuresRow?.count ?? 0,
    };

    this.logger.debug(`Extracted features for user=${userId}`);
    return result;
  }
}
