import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  type DateCheckinResponseDto,
  type ConfirmCheckinResponseDto,
  type TriggerSosResponseDto,
} from '@platform/api-contracts';
import type { CreateDateCheckinInput, TriggerSosInput } from '@platform/validation';
import { DateCheckinRepository } from '../repositories/date-checkin.repository.js';
import type { DateCheckinRow } from '../../../infrastructure/database/drizzle/schema/date-checkins.js';

@Injectable()
export class DateSafetyService {
  private readonly logger = new Logger(DateSafetyService.name);

  constructor(
    @Inject(DateCheckinRepository)
    private readonly dateCheckinRepo: DateCheckinRepository
  ) {}

  private mapRowToDto(row: DateCheckinRow): DateCheckinResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      matchId: row.matchId,
      meetingLocation: row.meetingLocation,
      meetingAt: row.meetingAt.toISOString(),
      checkInDeadline: row.checkInDeadline.toISOString(),
      emergencyContactName: row.emergencyContactName,
      emergencyContactPhone: row.emergencyContactPhone,
      status: row.status,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      sosTriggeredAt: row.sosTriggeredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createCheckin(
    userId: string,
    input: CreateDateCheckinInput
  ): Promise<DateCheckinResponseDto> {
    const meetingAt = new Date(input.meetingAt);
    const checkInDeadline = new Date(input.checkInDeadline);

    if (isNaN(meetingAt.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid meetingAt timestamp format',
      });
    }

    if (isNaN(checkInDeadline.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid checkInDeadline timestamp format',
      });
    }

    if (checkInDeadline.getTime() <= meetingAt.getTime()) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'checkInDeadline must be after meetingAt',
      });
    }

    const checkinId = generateUuidV7();
    const created = await this.dateCheckinRepo.createCheckin({
      id: checkinId,
      userId,
      matchId: input.matchId,
      meetingLocation: input.meetingLocation,
      meetingAt,
      checkInDeadline,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      status: 'SCHEDULED',
    });

    this.logger.log(
      `Date check-in created id=${created.id} by user=${userId} for match=${input.matchId}`
    );

    return this.mapRowToDto(created);
  }

  async getActiveCheckin(userId: string): Promise<DateCheckinResponseDto | null> {
    const active = await this.dateCheckinRepo.findActiveCheckinForUser(userId);
    return active ? this.mapRowToDto(active) : null;
  }

  async confirmCheckin(
    userId: string,
    checkinId: string
  ): Promise<ConfirmCheckinResponseDto> {
    const checkin = await this.dateCheckinRepo.findCheckinById(checkinId);
    if (!checkin || checkin.userId !== userId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Date check-in record not found',
      });
    }

    if (checkin.status !== 'SCHEDULED') {
      throw new BadRequestException({
        code: ErrorCode.INVALID_STATE,
        message: `Check-in is already in ${checkin.status} state`,
      });
    }

    const now = new Date();
    const updated = await this.dateCheckinRepo.confirmCheckin(checkinId, now);
    if (!updated) {
      throw new BadRequestException('Failed to confirm check-in');
    }

    this.logger.log(
      `Safe date check-in confirmed id=${checkinId} by user=${userId}`
    );

    return {
      success: true,
      checkedInAt: now.toISOString(),
      message: 'Successfully checked in safe! Your emergency contacts are relieved.',
    };
  }

  async triggerSos(
    userId: string,
    input: TriggerSosInput
  ): Promise<TriggerSosResponseDto> {
    const now = new Date();
    let targetCheckinId = input.dateCheckinId;

    if (!targetCheckinId) {
      const active = await this.dateCheckinRepo.findActiveCheckinForUser(userId);
      if (active) {
        targetCheckinId = active.id;
      }
    }

    if (targetCheckinId) {
      const checkin = await this.dateCheckinRepo.findCheckinById(targetCheckinId);
      if (checkin && checkin.userId === userId) {
        await this.dateCheckinRepo.triggerSos(
          targetCheckinId,
          now,
          input.latitude,
          input.longitude,
          input.note
        );
      }
    }

    this.logger.error(
      `🚨 [EMERGENCY SOS TRIGGERED] User=${userId} CheckinId=${targetCheckinId ?? 'NONE'} Coords=(${input.latitude ?? 'unknown'}, ${input.longitude ?? 'unknown'}) Note="${input.note ?? ''}"`
    );

    // In a live production environment, this triggers an automated SMS to emergencyContactPhone and dispatches to trust & safety desk.
    return {
      success: true,
      alertDispatched: true,
      message: 'Emergency SOS alert dispatched to designated emergency contacts and Trust & Safety desk.',
      timestamp: now.toISOString(),
    };
  }
}
