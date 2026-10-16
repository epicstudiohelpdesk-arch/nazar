export type DateCheckinStatus = 'SCHEDULED' | 'CHECKED_IN' | 'SOS_TRIGGERED' | 'CANCELLED';

export interface CreateDateCheckinRequestDto {
  readonly matchId: string;
  readonly meetingLocation: string;
  readonly meetingAt: string; // ISO 8601
  readonly checkInDeadline: string; // ISO 8601
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
}

export interface DateCheckinResponseDto {
  readonly id: string;
  readonly userId: string;
  readonly matchId: string;
  readonly meetingLocation: string;
  readonly meetingAt: string;
  readonly checkInDeadline: string;
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly status: DateCheckinStatus;
  readonly checkedInAt?: string | null;
  readonly sosTriggeredAt?: string | null;
  readonly createdAt: string;
}

export interface TriggerSosRequestDto {
  readonly dateCheckinId?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly note?: string | null;
}

export interface TriggerSosResponseDto {
  readonly success: boolean;
  readonly alertDispatched: boolean;
  readonly message: string;
  readonly timestamp: string;
}

export interface ConfirmCheckinResponseDto {
  readonly success: boolean;
  readonly checkedInAt: string;
  readonly message: string;
}
