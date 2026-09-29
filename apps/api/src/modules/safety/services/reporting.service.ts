import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  type CreateReportRequestDto,
  type ReportResponseDto,
  type ReportPriority,
  type ReportReasonCode,
} from '@platform/api-contracts';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { securityEvents } from '../../../infrastructure/database/drizzle/schema/security-events.js';
import { profiles } from '../../../infrastructure/database/drizzle/schema/profiles.js';
import { messages } from '../../../infrastructure/database/drizzle/schema/messages.js';
import { conversations } from '../../../infrastructure/database/drizzle/schema/conversations.js';
import { matches } from '../../../infrastructure/database/drizzle/schema/matches.js';
import { profileMedia } from '../../../infrastructure/database/drizzle/schema/profile-media.js';
import {
  REPORTS_REPOSITORY_TOKEN,
  type IReportsRepository,
} from '../repositories/reports.repository.interface.js';
import {
  MODERATION_CASES_REPOSITORY_TOKEN,
  type IModerationCasesRepository,
} from '../repositories/moderation-cases.repository.interface.js';
import { generateUuidV7 } from '@platform/domain';
import { eq } from 'drizzle-orm';

function determineReportPriority(reasonCode: ReportReasonCode): ReportPriority {
  switch (reasonCode) {
    case 'THREATS':
    case 'VIOLENCE_OR_DANGER':
    case 'MINOR_SAFETY_CONCERN':
    case 'SELF_HARM_CONCERN':
      return 'URGENT';
    case 'HARASSMENT':
    case 'ABUSE':
    case 'UNWANTED_SEXUAL_BEHAVIOR':
    case 'HATE_OR_DISCRIMINATION':
      return 'HIGH';
    case 'SCAM_OR_FRAUD':
    case 'OFF_PLATFORM_PAYMENT_SCAM':
    case 'IMPERSONATION':
    case 'SEXUAL_CONTENT':
    case 'FAKE_PROFILE':
      return 'NORMAL';
    case 'SPAM':
    case 'INAPPROPRIATE_CONTENT':
    case 'OTHER':
    default:
      return 'LOW';
  }
}

const PRIORITY_RANK: Record<ReportPriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
};

@Injectable()
export class ReportingService {
  constructor(
    @Inject(REPORTS_REPOSITORY_TOKEN)
    private readonly reportsRepo: IReportsRepository,
    @Inject(MODERATION_CASES_REPOSITORY_TOKEN)
    private readonly modCasesRepo: IModerationCasesRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async createReport(
    reporterUserId: string,
    input: CreateReportRequestDto
  ): Promise<ReportResponseDto> {
    // 1. Rate limiting check: max 15 reports per 15 minutes (Requirement 27)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await this.reportsRepo.countRecentReportsByReporter(
      reporterUserId,
      fifteenMinutesAgo
    );
    if (recentCount >= 15) {
      throw new HttpException(
        {
          code: ErrorCode.REPORT_RATE_LIMITED,
          message: 'Too many reports submitted. Please wait before reporting again.',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 2. Validate target existence, ownership, and accessibility (Requirements 7, 22-24, 35)
    const targetUserId = await this.resolveAndValidateTarget(
      reporterUserId,
      input.targetType,
      input.targetId
    );

    // 3. Deduplication check (Requirements 9, 28)
    const existingDuplicate = await this.reportsRepo.findOpenDuplicate(
      reporterUserId,
      input.targetType,
      input.targetId,
      input.reasonCode
    );

    if (existingDuplicate) {
      // Emit report.duplicated event and reject with 409 REPORT_DUPLICATE
      await this.databaseService.client.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'report.duplicated',
        aggregateType: 'REPORT',
        aggregateId: existingDuplicate.id,
        payload: {
          reportId: existingDuplicate.id,
          reporterUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          reasonCode: input.reasonCode,
          duplicatedAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });

      throw new HttpException(
        {
          code: ErrorCode.REPORT_DUPLICATE,
          message: 'An active report with this reason already exists for this target',
        },
        HttpStatus.CONFLICT
      );
    }

    // 4. Server-authoritative priority assignment (Requirement 8)
    const priority = determineReportPriority(input.reasonCode);
    const reportId = generateUuidV7();
    const now = new Date();

    try {
      return await this.databaseService.withTransaction(async (tx) => {
        // Find or create moderation case for subject user
        let modCase = await this.modCasesRepo.findOpenCaseBySubject(targetUserId, tx);
        if (!modCase) {
          modCase = await this.modCasesRepo.createCase(
            {
              id: generateUuidV7(),
              subjectUserId: targetUserId,
              sourceType: 'REPORT',
              sourceId: reportId,
              caseType: input.reasonCode,
              status: 'OPEN',
              priority,
              openedAt: now,
              updatedAt: now,
            },
            tx
          );

          await tx.insert(outboxEvents).values({
            id: generateUuidV7(),
            eventType: 'moderation.case.created',
            aggregateType: 'MODERATION_CASE',
            aggregateId: modCase.id,
            payload: {
              caseId: modCase.id,
              subjectUserId: targetUserId,
              priority,
              reasonCode: input.reasonCode,
              createdAt: now.toISOString(),
            },
            status: 'PENDING',
          });
        } else {
          // Escalate priority if new report priority is higher
          const currentRank = PRIORITY_RANK[modCase.priority as ReportPriority] || 1;
          const newRank = PRIORITY_RANK[priority];
          const escalatedPriority = newRank > currentRank ? priority : modCase.priority;

          await this.modCasesRepo.updateCase(
            modCase.id,
            {
              priority: escalatedPriority,
              updatedAt: now,
            },
            tx
          );
        }

        // Insert report
        const report = await this.reportsRepo.createReport(
          {
            id: reportId,
            reporterUserId,
            targetType: input.targetType,
            targetId: input.targetId,
            targetUserId,
            reasonCode: input.reasonCode,
            description: input.description || null,
            metadata: input.metadata || null,
            status: 'OPEN',
            priority,
            moderationCaseId: modCase.id,
            createdAt: now,
            updatedAt: now,
          },
          tx
        );

        // Record case history event
        await this.modCasesRepo.createCaseEvent(
          {
            id: generateUuidV7(),
            caseId: modCase.id,
            eventType: 'REPORT_ATTACHED',
            actorUserId: reporterUserId,
            payload: {
              reportId: report.id,
              reasonCode: input.reasonCode,
              targetType: input.targetType,
              targetId: input.targetId,
            },
            createdAt: now,
          },
          tx
        );

        // Emit outbox event
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'report.created',
          aggregateType: 'REPORT',
          aggregateId: report.id,
          payload: {
            reportId: report.id,
            reporterUserId,
            targetUserId,
            targetType: input.targetType,
            targetId: input.targetId,
            reasonCode: input.reasonCode,
            priority,
            createdAt: now.toISOString(),
          },
          status: 'PENDING',
        });

        // Write security audit event
        await tx.insert(securityEvents).values({
          id: generateUuidV7(),
          userId: reporterUserId,
          eventType: 'report.created',
          severity: priority === 'URGENT' ? 'HIGH' : 'INFO',
          metadata: {
            reportId: report.id,
            targetUserId,
            targetType: input.targetType,
            targetId: input.targetId,
            reasonCode: input.reasonCode,
          },
        });

        return {
          id: report.id,
          reporterUserId: report.reporterUserId,
          targetType: report.targetType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          targetId: report.targetId,
          reasonCode: report.reasonCode as ReportReasonCode,
          status: 'OPEN',
          createdAt: report.createdAt.toISOString(),
          resolvedAt: null,
        };
      });
    } catch (err: unknown) {
      const dbErr = err as { code?: string; cause?: { code?: string }; message?: string };
      if (
        dbErr?.code === '23505' ||
        dbErr?.cause?.code === '23505' ||
        String(dbErr?.message).includes('idx_reports_open_dedup')
      ) {
        // Emit report.duplicated event and reject with 409 REPORT_DUPLICATE
        await this.databaseService.client.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'report.duplicated',
          aggregateType: 'REPORT',
          aggregateId: reportId,
          payload: {
            reportId,
            reporterUserId,
            targetType: input.targetType,
            targetId: input.targetId,
            reasonCode: input.reasonCode,
            duplicatedAt: new Date().toISOString(),
          },
          status: 'PENDING',
        });

        throw new HttpException(
          {
            code: ErrorCode.REPORT_DUPLICATE,
            message: 'An active report with this reason already exists for this target',
          },
          HttpStatus.CONFLICT
        );
      }
      throw err;
    }
  }

  async getReport(reporterUserId: string, reportId: string): Promise<ReportResponseDto> {
    const report = await this.reportsRepo.findReportById(reportId);
    if (!report) {
      throw new HttpException(
        {
          code: ErrorCode.REPORT_TARGET_NOT_FOUND,
          message: 'Report not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    // Access control: only the reporter can view their report submission
    if (report.reporterUserId !== reporterUserId) {
      throw new HttpException(
        {
          code: ErrorCode.SAFETY_ACCESS_DENIED,
          message: 'Access to this report is denied',
        },
        HttpStatus.FORBIDDEN
      );
    }

    return {
      id: report.id,
      reporterUserId: report.reporterUserId,
      targetType: report.targetType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      targetId: report.targetId,
      reasonCode: report.reasonCode as ReportReasonCode,
      status: report.status as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() || null,
    };
  }

  private async resolveAndValidateTarget(
    reporterUserId: string,
    targetType: string,
    targetId: string
  ): Promise<string> {
    const client = this.databaseService.client;

    if (targetType === 'USER') {
      if (reporterUserId === targetId) {
        throw new HttpException(
          {
            code: ErrorCode.SELF_REPORT_NOT_ALLOWED,
            message: 'You cannot report your own account',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const [targetProfile] = await client
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.userId, targetId))
        .limit(1);

      if (!targetProfile) {
        throw new HttpException(
          {
            code: ErrorCode.REPORT_TARGET_NOT_FOUND,
            message: 'Target user does not exist',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return targetProfile.userId;
    }

    if (targetType === 'PROFILE') {
      const [profile] = await client
        .select({ id: profiles.id, userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.id, targetId))
        .limit(1);

      if (!profile) {
        throw new HttpException(
          {
            code: ErrorCode.REPORT_TARGET_NOT_FOUND,
            message: 'Target profile does not exist',
          },
          HttpStatus.NOT_FOUND
        );
      }

      if (profile.userId === reporterUserId) {
        throw new HttpException(
          {
            code: ErrorCode.SELF_REPORT_NOT_ALLOWED,
            message: 'You cannot report your own profile',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return profile.userId;
    }

    if (targetType === 'MESSAGE') {
      const [message] = await client
        .select()
        .from(messages)
        .where(eq(messages.id, targetId))
        .limit(1);

      if (!message) {
        throw new HttpException(
          {
            code: ErrorCode.REPORT_TARGET_NOT_FOUND,
            message: 'Target message does not exist',
          },
          HttpStatus.NOT_FOUND
        );
      }

      // Verify conversation membership for reporter
      const [conv] = await client
        .select({ matchId: conversations.matchId })
        .from(conversations)
        .where(eq(conversations.id, message.conversationId))
        .limit(1);

      if (!conv) {
        throw new HttpException(
          {
            code: ErrorCode.REPORT_TARGET_NOT_FOUND,
            message: 'Message conversation not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      const [match] = await client
        .select()
        .from(matches)
        .where(eq(matches.id, conv.matchId))
        .limit(1);

      if (!match || (match.userAId !== reporterUserId && match.userBId !== reporterUserId)) {
        throw new HttpException(
          {
            code: ErrorCode.SAFETY_ACCESS_DENIED,
            message: 'You are not a participant in the conversation containing this message',
          },
          HttpStatus.FORBIDDEN
        );
      }

      if (message.senderUserId === reporterUserId) {
        throw new HttpException(
          {
            code: ErrorCode.SELF_REPORT_NOT_ALLOWED,
            message: 'You cannot report your own message',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return message.senderUserId;
    }

    if (targetType === 'CONVERSATION') {
      const [conv] = await client
        .select()
        .from(conversations)
        .where(eq(conversations.id, targetId))
        .limit(1);

      if (!conv) {
        throw new HttpException(
          {
            code: ErrorCode.REPORT_TARGET_NOT_FOUND,
            message: 'Target conversation does not exist',
          },
          HttpStatus.NOT_FOUND
        );
      }

      const [match] = await client
        .select()
        .from(matches)
        .where(eq(matches.id, conv.matchId))
        .limit(1);

      if (!match || (match.userAId !== reporterUserId && match.userBId !== reporterUserId)) {
        throw new HttpException(
          {
            code: ErrorCode.SAFETY_ACCESS_DENIED,
            message: 'You are not a participant in this conversation',
          },
          HttpStatus.FORBIDDEN
        );
      }

      const otherUserId = match.userAId === reporterUserId ? match.userBId : match.userAId;
      return otherUserId;
    }

    if (targetType === 'MEDIA') {
      const [media] = await client
        .select({ id: profileMedia.id, userId: profileMedia.userId })
        .from(profileMedia)
        .where(eq(profileMedia.id, targetId))
        .limit(1);

      if (!media) {
        throw new HttpException(
          {
            code: ErrorCode.REPORT_TARGET_NOT_FOUND,
            message: 'Target media asset does not exist',
          },
          HttpStatus.NOT_FOUND
        );
      }

      if (media.userId === reporterUserId) {
        throw new HttpException(
          {
            code: ErrorCode.SELF_REPORT_NOT_ALLOWED,
            message: 'You cannot report your own media',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return media.userId;
    }

    throw new HttpException(
      {
        code: ErrorCode.REPORT_INVALID_TARGET,
        message: 'Invalid report target type',
      },
      HttpStatus.BAD_REQUEST
    );
  }
}
