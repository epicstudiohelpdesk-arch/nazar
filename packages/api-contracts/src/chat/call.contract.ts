export type CallType = 'AUDIO' | 'VIDEO';

export type CallStatus =
  | 'RINGING'
  | 'CONNECTED'
  | 'ENDED'
  | 'DECLINED'
  | 'MISSED'
  | 'BUSY';

export interface InitiateCallRequestDto {
  readonly conversationId: string;
  readonly callType: CallType;
}

export interface InitiateCallResponseDto {
  readonly callSessionId: string;
  readonly status: CallStatus;
  readonly callerUserId: string;
  readonly calleeUserId: string;
  readonly callType: CallType;
  readonly startedAt: string;
}

export type SignalType = 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE';

export interface CallSignalDto {
  readonly callSessionId: string;
  readonly type: SignalType;
  readonly sdp?: string | null;
  readonly candidate?: unknown | null;
}

export interface EndCallRequestDto {
  readonly callSessionId: string;
  readonly reason?: 'DECLINED' | 'ENDED' | 'MISSED' | 'TIMEOUT' | string;
}

export interface EndCallResponseDto {
  readonly success: boolean;
  readonly callSessionId: string;
  readonly durationSeconds: number;
}

export interface CallSessionDto {
  readonly id: string;
  readonly conversationId: string;
  readonly callerUserId: string;
  readonly calleeUserId: string;
  readonly callType: CallType;
  readonly status: CallStatus;
  readonly startedAt: string;
  readonly endedAt?: string | null;
  readonly durationSeconds?: number | null;
}
