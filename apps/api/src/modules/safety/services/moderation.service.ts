import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  type ModerationDecisionOutcome,
  type UserRestrictionType,
} from '@platform/api-contracts';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { securityEvents } from '../../../infrastructure/database/drizzle/schema/security-events.js';
import {
  MODERATION_CASES_REPOSITORY_TOKEN,
  type IModerationCasesRepository,
} from '../repositories/moderation-cases.repository.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../repositories/user-restrictions.repository.interface.js';
import {
  SESSION_REPOSITORY_TOKEN,
  type ISessionRepository,
} from '../../auth/repositories/session.repository.js';
import { generateUuidV7 } from '@platform/domain';

export interface ApplyDecisionOptions {
  readonly durationHours?: number;
  readonly reason?: string;
  readonly customPayload?: Record<string, unknown>;
}

@Injectable()
export class ModerationService {
  constructor(
    @Inject(MODERATION_CASES_REPOSITORY_TOKEN)
    private readonly modCasesRepo: IModerationCasesRepository,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepo: ISessionRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async applyDecision(
    caseId: string,
    actorUserId: string,
    decision: ModerationDecisionOutcome,
    options: ApplyDecisionOptions = {}
  ): Promise<{ success: boolean; decision: ModerationDecisionOutcome }> {
    const modCase = await this.modCasesRepo.findCaseById(caseId);
    if (!modCase) {
      throw new HttpException(
        {
          code: ErrorCode.NOT_FOUND,
          message: 'Moderation case not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const now = new Date();
    const subjectUserId = modCase.subjectUserId;

    return this.databaseService.withTransaction(async (tx) => {
      // 1. Determine restriction type mapping if applicable
      let restrictionType: UserRestrictionType | null = null;
      let expiresAt: Date | null = null;
      let isSevereSessionRevocation = false;

      if (options.durationHours && options.durationHours > 0) {
        expiresAt = new Date(now.getTime() + options.durationHours * 3600 * 1000);
      }

      switch (decision) {
        case 'PROFILE_RESTRICTED':
          restrictionType = 'PROFILE_VISIBILITY';
          break;
        case 'INTERACTION_RESTRICTED':
          restrictionType = 'LIKES';
          break;
        case 'MESSAGING_RESTRICTED':
          restrictionType = 'MESSAGING';
          break;
        case 'TEMPORARY_SUSPENSION':
          restrictionType = 'FULL_ACCOUNT';
          isSevereSessionRevocation = true;
          break;
        case 'PERMANENT_SUSPENSION':
        case 'BAN':
          restrictionType = 'FULL_ACCOUNT';
          expiresAt = null; // Permanent
          isSevereSessionRevocation = true;
          break;
        default:
          break;
      }

      // 2. Insert restriction record if applicable
      if (restrictionType) {
        const restriction = await this.userRestrictionsRepo.createRestriction(
          {
            id: generateUuidV7(),
            userId: subjectUserId,
            restrictionType,
            sourceCaseId: modCase.id,
            reasonCode: modCase.caseType,
            startsAt: now,
            expiresAt,
            createdAt: now,
          },
          tx
        );

        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'restriction.created',
          aggregateType: 'USER_RESTRICTION',
          aggregateId: restriction.id,
          payload: {
            restrictionId: restriction.id,
            userId: subjectUserId,
            restrictionType,
            caseId: modCase.id,
            expiresAt: expiresAt?.toISOString() || null,
            createdAt: now.toISOString(),
          },
          status: 'PENDING',
        });
      }

      // 3. For severe account-level restrictions, revoke all durable sessions (Requirement 17)
      if (isSevereSessionRevocation) {
        await this.sessionRepo.revokeAllUserSessions(subjectUserId, 'ACCOUNT_ENFORCEMENT');

        const eventType = decision === 'BAN' ? 'account.banned' : 'account.suspended';
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType,
          aggregateType: 'USER',
          aggregateId: subjectUserId,
          payload: {
            userId: subjectUserId,
            decision,
            caseId: modCase.id,
            enforcedAt: now.toISOString(),
          },
          status: 'PENDING',
        });
      }

      // 4. Update case status & record resolution
      await this.modCasesRepo.updateCase(
        modCase.id,
        {
          status: 'RESOLVED',
          resolutionDecision: decision,
          resolvedAt: now,
          updatedAt: now,
        },
        tx
      );

      // 5. Append decision event to case history
      await this.modCasesRepo.createCaseEvent(
        {
          id: generateUuidV7(),
          caseId: modCase.id,
          eventType: 'DECISION_MADE',
          actorUserId,
          payload: {
            decision,
            restrictionType,
            expiresAt: expiresAt?.toISOString() || null,
            reason: options.reason || 'Decision applied by moderation workflow',
            ...options.customPayload,
          },
          createdAt: now,
        },
        tx
      );

      // 6. Security event telemetry on subject user account
      await tx.insert(securityEvents).values({
        id: generateUuidV7(),
        userId: subjectUserId,
        eventType: 'moderation.decision.created',
        severity: isSevereSessionRevocation ? 'HIGH' : 'MEDIUM',
        metadata: {
          caseId: modCase.id,
          actorUserId,
          decision,
          restrictionType,
        },
      });

      return {
        success: true,
        decision,
      };
    });
  }

  async getCaseDetails(caseId: string) {
    const modCase = await this.modCasesRepo.findCaseById(caseId);
    if (!modCase) {
      throw new HttpException(
        {
          code: ErrorCode.NOT_FOUND,
          message: 'Case not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const events = await this.modCasesRepo.findCaseEvents(caseId);
    return {
      case: modCase,
      events,
    };
  }
}
