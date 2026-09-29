import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  ErrorCode,
  type InteractionResponseDto,
  type UndoResponseDto,
  type InteractionHistoryResponseDto,
} from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import {
  INTERACTIONS_REPOSITORY_TOKEN,
  type IInteractionsRepository,
} from '../repositories/interactions.repository.interface.js';
import {
  MATCHES_REPOSITORY_TOKEN,
  type IMatchesRepository,
} from '../../matches/repositories/matches.repository.interface.js';
import { normalizeUserPair } from '../../matches/domain/match.utils.js';
import { SafetyEnforcementService } from '../../safety/services/safety-enforcement.service.js';

@Injectable()
export class InteractionsService {
  constructor(
    @Inject(INTERACTIONS_REPOSITORY_TOKEN)
    private readonly interactionsRepo: IInteractionsRepository,
    @Inject(MATCHES_REPOSITORY_TOKEN)
    private readonly matchesRepo: IMatchesRepository,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(SafetyEnforcementService)
    private readonly safetyEnforcement: SafetyEnforcementService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async like(actorUserId: string, targetUserId: string): Promise<InteractionResponseDto> {
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

      if (isReciprocalLike) {
        const { match, wasCreated } = await this.matchesRepo.createOrActivateMatchTx(
          tx,
          userAId,
          userBId
        );
        matched = match.status === 'ACTIVE';
        matchId = match.id;

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
            createdAt: interaction.createdAt.toISOString(),
          },
          status: 'PENDING',
        });
      }

      return {
        targetUserId: resolvedTargetUserId,
        interaction: 'LIKE' as const,
        matched,
        matchId,
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
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
