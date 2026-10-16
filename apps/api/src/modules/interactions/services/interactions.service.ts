import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import {
  ErrorCode,
  type InteractionResponseDto,
  type UndoResponseDto,
  type InteractionHistoryResponseDto,
  type LikesYouResponseDto,
  type InboundLikeItemDto,
  type MatchStatus,
  type TargetAttachmentType,
} from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';
import { generateUuidV7 } from '@platform/domain';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { S3StorageService } from '../../../infrastructure/storage/s3-storage.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { conversations } from '../../../infrastructure/database/drizzle/schema/conversations.js';
import { messages } from '../../../infrastructure/database/drizzle/schema/messages.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import {
  INTEREST_REPOSITORY_TOKEN,
  type IInterestRepository,
} from '../../profiles/repositories/interest.repository.js';
import {
  INTERACTIONS_REPOSITORY_TOKEN,
  type IInteractionsRepository,
  type InteractionAttachmentOptions,
} from '../repositories/interactions.repository.interface.js';
import {
  MATCHES_REPOSITORY_TOKEN,
  type IMatchesRepository,
} from '../../matches/repositories/matches.repository.interface.js';
import { normalizeUserPair } from '../../matches/domain/match.utils.js';
import { SafetyEnforcementService } from '../../safety/services/safety-enforcement.service.js';
import { EntitlementService } from '../../payments/services/entitlement.service.js';
import { SmartPhotosService } from '../../profiles/services/smart-photos.service.js';

const ACTIVE_MATCH_CAP = 5;
const MATCH_EXPIRATION_HOURS = 48;

@Injectable()
export class InteractionsService {
  constructor(
    @Inject(INTERACTIONS_REPOSITORY_TOKEN)
    private readonly interactionsRepo: IInteractionsRepository,
    @Inject(MATCHES_REPOSITORY_TOKEN)
    private readonly matchesRepo: IMatchesRepository,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(INTEREST_REPOSITORY_TOKEN)
    private readonly interestRepo: IInterestRepository,
    @Inject(SafetyEnforcementService)
    private readonly safetyEnforcement: SafetyEnforcementService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(S3StorageService)
    private readonly storageService: S3StorageService,
    @Inject(SmartPhotosService)
    private readonly smartPhotosService: SmartPhotosService
  ) {}

  async like(
    actorUserId: string,
    targetUserId: string,
    attachmentOptions?: InteractionAttachmentOptions
  ): Promise<InteractionResponseDto> {
    // 1. Target existence and eligibility check
    let targetProfile = await this.profileRepo.findByUserId(targetUserId);
    if (!targetProfile) {
      targetProfile = await this.profileRepo.findById(targetUserId);
    }

    if (!targetProfile) {
      throw new HttpException(
        {
          code: ErrorCode.INTERACTION_TARGET_NOT_FOUND,
          message: 'Target user profile not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const resolvedTargetUserId = targetProfile.userId;

    // 2. Self interaction check
    if (actorUserId === resolvedTargetUserId) {
      throw new HttpException(
        {
          code: ErrorCode.INTERACTION_SELF_TARGET,
          message: 'A user cannot like themselves',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 3. Safety checks (blocking and interaction restrictions - Gate 09)
    await this.safetyEnforcement.assertCanInteract(actorUserId, resolvedTargetUserId);

    if (targetProfile.visibility !== 'ACTIVE') {
      throw new HttpException(
        {
          code: ErrorCode.INTERACTION_NOT_ALLOWED,
          message: 'Target user is not currently discoverable',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 3. Transactional like & reciprocal match detection
    return this.databaseService.withTransaction(async (tx) => {
      const { userAId, userBId } = normalizeUserPair(actorUserId, resolvedTargetUserId);

      // Acquire transaction-scoped advisory lock for the normalized user pair
      // to serialize concurrent reciprocal likes and guarantee deterministic match formation
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext('match:' || ${userAId} || ':' || ${userBId})
        );
      `);

      const existing = await this.interactionsRepo.findInteraction(
        actorUserId,
        resolvedTargetUserId,
        tx
      );
      const isRepeatLike = existing?.type === 'LIKE';

      const interaction = await this.interactionsRepo.upsertInteraction(
        actorUserId,
        resolvedTargetUserId,
        'LIKE',
        attachmentOptions,
        tx
      );

      // Check reciprocal interaction
      const reciprocal = await this.interactionsRepo.findInteraction(
        resolvedTargetUserId,
        actorUserId,
        tx
      );
      const isReciprocalLike = reciprocal?.type === 'LIKE';

      let matched = false;
      let matchId: string | null = null;
      let matchStatus: MatchStatus | undefined;
      let expiresAt: string | null = null;
      let sharedInterests: string[] = [];
      let suggestedIcebreakers: string[] = [];

      if (isReciprocalLike) {
        // Anti-Hoarding Focus Cap: Check active matches for both users
        const [actorActiveCount, targetActiveCount] = await Promise.all([
          this.matchesRepo.countActiveMatchesForUser(actorUserId, tx),
          this.matchesRepo.countActiveMatchesForUser(resolvedTargetUserId, tx),
        ]);

        const shouldQueue =
          actorActiveCount >= ACTIVE_MATCH_CAP || targetActiveCount >= ACTIVE_MATCH_CAP;
        const initialStatus: MatchStatus = shouldQueue ? 'QUEUED' : 'ACTIVE';

        // 48-Hour Conversational Expiry
        const expiresAtDate =
          initialStatus === 'ACTIVE'
            ? new Date(Date.now() + MATCH_EXPIRATION_HOURS * 3600 * 1000)
            : null;

        const { match, wasCreated } = await this.matchesRepo.createOrActivateMatchTx(
          tx,
          userAId,
          userBId,
          { status: initialStatus, expiresAt: expiresAtDate }
        );

        matched = match.status === 'ACTIVE' || match.status === 'QUEUED';
        matchId = match.id;
        matchStatus = match.status as MatchStatus;
        expiresAt = match.expiresAt ? match.expiresAt.toISOString() : null;

        // Mutual Interest Intersection & Icebreaker Generation
        const actorProfile = await this.profileRepo.findByUserId(actorUserId, tx);
        if (actorProfile && targetProfile) {
          const [actorInterests, targetInterests] = await Promise.all([
            this.interestRepo.findByProfileId(actorProfile.id, tx),
            this.interestRepo.findByProfileId(targetProfile.id, tx),
          ]);

          const targetInterestSet = new Set(targetInterests.map((i) => i.name.toLowerCase()));
          sharedInterests = actorInterests
            .filter((i) => targetInterestSet.has(i.name.toLowerCase()))
            .map((i) => i.name);

          if (sharedInterests.length > 0) {
            suggestedIcebreakers = sharedInterests
              .slice(0, 3)
              .map((interest) => `Ask them about their passion for ${interest}!`);
          } else {
            suggestedIcebreakers = [
              'Say hi and ask what their favorite weekend activity is!',
              'Compliment one of their prompt answers to break the ice.',
            ];
          }
        }

        // If an inline comment was provided and the match is ACTIVE, initialize the first message
        if (matched && match.status === 'ACTIVE' && attachmentOptions?.comment) {
          const convRows = await tx
            .select()
            .from(conversations)
            .where(eq(conversations.matchId, match.id))
            .limit(1);

          if (convRows.length > 0 && convRows[0]) {
            const conv = convRows[0];
            const msgId = generateUuidV7();
            const clientMsgId = `cmsg_${generateUuidV7()}`;

            await tx.insert(messages).values({
              id: msgId,
              conversationId: conv.id,
              senderUserId: actorUserId,
              clientMessageId: clientMsgId,
              messageType: 'TEXT',
              body: attachmentOptions.comment,
              metadata: {
                attachmentType: attachmentOptions.targetAttachmentType || 'PROFILE',
                attachmentId: attachmentOptions.targetAttachmentId || null,
              },
              createdAt: new Date(),
            });

            await tx
              .update(conversations)
              .set({
                lastMessageId: msgId,
                lastMessageAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(conversations.id, conv.id));

            await tx.insert(outboxEvents).values({
              id: generateUuidV7(),
              eventType: 'message.created',
              aggregateType: 'MESSAGE',
              aggregateId: msgId,
              payload: {
                messageId: msgId,
                conversationId: conv.id,
                senderUserId: actorUserId,
                recipientUserId: resolvedTargetUserId,
                body: attachmentOptions.comment,
                clientMessageId: clientMsgId,
                createdAt: new Date().toISOString(),
              },
              status: 'PENDING',
            });
          }
        }

        // Emit match.created event if a new match was formed or re-activated
        if (wasCreated) {
          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'match.created',
            aggregateType: 'MATCH',
            aggregateId: match.id,
            payload: {
              matchId: match.id,
              userAId,
              userBId,
              actorUserId,
              targetUserId: resolvedTargetUserId,
              status: match.status,
              expiresAt,
              sharedInterests,
              suggestedIcebreakers,
              matchedAt: match.matchedAt.toISOString(),
            },
            status: 'PENDING',
          });
        }
      }

      // Emit interaction.liked event only if not an identical repeat like
      if (!isRepeatLike) {
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'interaction.liked',
          aggregateType: 'INTERACTION',
          aggregateId: interaction.id,
          payload: {
            interactionId: interaction.id,
            actorUserId,
            targetUserId: resolvedTargetUserId,
            type: 'LIKE',
            matched,
            matchId,
            targetAttachmentType: interaction.targetAttachmentType,
            targetAttachmentId: interaction.targetAttachmentId,
            comment: interaction.comment,
            createdAt: interaction.createdAt.toISOString(),
          },
          status: 'PENDING',
        });
      }

      // Multi-Armed Bandit photo optimization: record like for candidate's photo
      const mediaAttachmentId =
        attachmentOptions?.targetAttachmentType === 'MEDIA'
          ? attachmentOptions.targetAttachmentId
          : undefined;
      void this.smartPhotosService.recordCandidateLike(resolvedTargetUserId, mediaAttachmentId);

      return {
        targetUserId: resolvedTargetUserId,
        interaction: 'LIKE' as const,
        matched,
        matchId,
        targetAttachmentType:
          (interaction.targetAttachmentType as TargetAttachmentType) || undefined,
        targetAttachmentId: interaction.targetAttachmentId || undefined,
        comment: interaction.comment || undefined,
        ...(matched
          ? {
              matchStatus,
              expiresAt,
              ...(sharedInterests.length > 0 ? { sharedInterests } : {}),
              ...(suggestedIcebreakers.length > 0 ? { suggestedIcebreakers } : {}),
            }
          : {}),
      };
    });
  }

  async pass(actorUserId: string, targetUserId: string): Promise<InteractionResponseDto> {
    // 1. Target existence check (accepts either targetUserId or targetProfileId)
    let targetProfile = await this.profileRepo.findByUserId(targetUserId);
    if (!targetProfile) {
      targetProfile = await this.profileRepo.findById(targetUserId);
    }

    if (!targetProfile) {
      throw new HttpException(
        {
          code: ErrorCode.INTERACTION_TARGET_NOT_FOUND,
          message: 'Target user profile not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const resolvedTargetUserId = targetProfile.userId;

    // 2. Self interaction check
    if (actorUserId === resolvedTargetUserId) {
      throw new HttpException(
        {
          code: ErrorCode.INTERACTION_SELF_TARGET,
          message: 'A user cannot pass themselves',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 3. Safety checks (blocking and interaction restrictions - Gate 09)
    await this.safetyEnforcement.assertCanInteract(actorUserId, resolvedTargetUserId);

    // 4. Transactional pass mutation
    return this.databaseService.withTransaction(async (tx) => {
      const existing = await this.interactionsRepo.findInteraction(
        actorUserId,
        resolvedTargetUserId,
        tx
      );
      const isRepeatPass = existing?.type === 'PASS';

      if (existing?.type === 'LIKE') {
        const { userAId, userBId } = normalizeUserPair(actorUserId, resolvedTargetUserId);
        const match = await this.matchesRepo.findMatchByUsers(userAId, userBId, tx);
        if (match && match.status === 'ACTIVE') {
          throw new HttpException(
            {
              code: ErrorCode.INTERACTION_INVALID_TRANSITION,
              message: 'Cannot pass an actively matched user. Please unmatch first.',
            },
            HttpStatus.BAD_REQUEST
          );
        }
      }

      const interaction = await this.interactionsRepo.upsertInteraction(
        actorUserId,
        resolvedTargetUserId,
        'PASS',
        undefined,
        tx
      );

      if (!isRepeatPass) {
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'interaction.passed',
          aggregateType: 'INTERACTION',
          aggregateId: interaction.id,
          payload: {
            interactionId: interaction.id,
            actorUserId,
            targetUserId: resolvedTargetUserId,
            type: 'PASS',
            createdAt: interaction.createdAt.toISOString(),
          },
          status: 'PENDING',
        });
      }

      return {
        targetUserId: resolvedTargetUserId,
        interaction: 'PASS' as const,
        matched: false,
        matchId: null,
      };
    });
  }

  async undo(actorUserId: string): Promise<UndoResponseDto> {
    return this.databaseService.withTransaction(async (tx) => {
      const recent = await this.interactionsRepo.findRecentInteraction(actorUserId, tx);
      if (!recent) {
        throw new HttpException(
          {
            code: ErrorCode.UNDO_NOT_ALLOWED,
            message: 'No recent interaction to undo',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Safety check
      await this.safetyEnforcement.assertCanInteract(actorUserId, recent.targetUserId);

      if (recent.type === 'LIKE') {
        const { userAId, userBId } = normalizeUserPair(actorUserId, recent.targetUserId);
        const match = await this.matchesRepo.findMatchByUsers(userAId, userBId, tx);
        if (match && match.status === 'ACTIVE') {
          throw new HttpException(
            {
              code: ErrorCode.UNDO_NOT_ALLOWED,
              message:
                'Cannot undo a like that resulted in an active match. Please unmatch instead.',
            },
            HttpStatus.BAD_REQUEST
          );
        }
      }

      await this.interactionsRepo.deleteInteraction(recent.id, tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'interaction.undone',
        aggregateType: 'INTERACTION',
        aggregateId: recent.id,
        payload: {
          interactionId: recent.id,
          actorUserId,
          targetUserId: recent.targetUserId,
          previousType: recent.type,
        },
        status: 'PENDING',
      });

      return {
        undone: true,
        targetUserId: recent.targetUserId,
        previousInteraction: recent.type as 'LIKE' | 'PASS',
      };
    });
  }

  async getHistory(actorUserId: string, limit = 50): Promise<InteractionHistoryResponseDto> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.interactionsRepo.findInteractionsByActor(actorUserId, safeLimit);
    return {
      items: rows.map((r) => ({
        id: r.id,
        targetUserId: r.targetUserId,
        type: r.type as 'LIKE' | 'PASS',
        targetAttachmentType: (r.targetAttachmentType as TargetAttachmentType) || undefined,
        targetAttachmentId: r.targetAttachmentId || undefined,
        comment: r.comment || undefined,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async getLikesYou(userId: string, limit = 50): Promise<LikesYouResponseDto> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const [hasSeeLikes, hasPremium] = await Promise.all([
      this.entitlementService.hasEntitlement(userId, 'SEE_LIKES').catch(() => false),
      this.entitlementService.hasEntitlement(userId, 'PREMIUM').catch(() => false),
    ]);

    const hasEntitlement = hasSeeLikes || hasPremium;

    const { items, totalCount } = await this.interactionsRepo.findInboundLikes(userId, safeLimit);

    const mappedItems: InboundLikeItemDto[] = items.map((rec) => {
      const isBlurred = !hasEntitlement;
      const photoUrl = rec.primaryPhotoKey
        ? this.storageService.getPublicUrl(rec.primaryPhotoKey)
        : null;

      if (isBlurred) {
        return {
          id: rec.id,
          actorUserId: rec.actorUserId,
          isBlurred: true,
          targetAttachmentType: (rec.targetAttachmentType as TargetAttachmentType) || undefined,
          targetAttachmentId: rec.targetAttachmentId || undefined,
          comment: undefined, // Redacted for non-subscribers
          createdAt: rec.createdAt.toISOString(),
          profile: null,
          blurredPhotoUrl: photoUrl,
        };
      }

      const age = rec.dateOfBirth ? calculateAge(rec.dateOfBirth) : 25;

      return {
        id: rec.id,
        actorUserId: rec.actorUserId,
        isBlurred: false,
        targetAttachmentType: (rec.targetAttachmentType as TargetAttachmentType) || undefined,
        targetAttachmentId: rec.targetAttachmentId || undefined,
        comment: rec.comment || undefined,
        createdAt: rec.createdAt.toISOString(),
        profile: rec.profileId
          ? {
              id: rec.profileId,
              userId: rec.actorUserId,
              displayName: rec.displayName || 'Member',
              age,
              city: rec.city,
              occupation: rec.occupation,
              photoUrl,
              isVerified: rec.isVerified ?? false,
            }
          : null,
        blurredPhotoUrl: null,
      };
    });

    return {
      totalCount,
      hasEntitlement,
      items: mappedItems,
      nextCursor: null,
    };
  }
}
