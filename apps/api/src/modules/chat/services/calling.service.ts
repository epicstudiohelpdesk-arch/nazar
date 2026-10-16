import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  type InitiateCallResponseDto,
  type EndCallResponseDto,
  type CallSessionDto,
} from '@platform/api-contracts';
import type { InitiateCallInput, EndCallInput } from '@platform/validation';
import { CallingRepository } from '../repositories/calling.repository.js';
import { ConversationsService } from './conversations.service.js';
import { SafetyEnforcementService } from '../../safety/services/safety-enforcement.service.js';

@Injectable()
export class CallingService {
  constructor(
    @Inject(CallingRepository)
    private readonly callingRepo: CallingRepository,
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService,
    @Inject(SafetyEnforcementService)
    private readonly safetyEnforcement: SafetyEnforcementService
  ) {}

  async initiateCall(
    callerUserId: string,
    input: InitiateCallInput
  ): Promise<InitiateCallResponseDto> {
    const { conversation, match, otherUserId } =
      await this.conversationsService.assertConversationAccess(
        callerUserId,
        input.conversationId
      );

    if (match.status !== 'ACTIVE' || conversation.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ErrorCode.CONVERSATION_CLOSED,
        message: 'Cannot call in an inactive match or closed conversation',
      });
    }

    // Safety enforcement: ensure no active blocks or restrictions
    await this.safetyEnforcement.assertCanInteract(callerUserId, otherUserId);

    // Bumble-style Anti-Harassment Gate:
    // Both members must have exchanged messages before video or audio calling is allowed
    const [callerMsgs, calleeMsgs] = await Promise.all([
      this.callingRepo.countUserMessages(input.conversationId, callerUserId),
      this.callingRepo.countUserMessages(input.conversationId, otherUserId),
    ]);

    if (callerMsgs === 0 || calleeMsgs === 0) {
      throw new ForbiddenException({
        code: ErrorCode.INTERACTION_NOT_ALLOWED,
        message: 'Both members must exchange messages before starting an in-app audio or video call.',
      });
    }

    const callSessionId = generateUuidV7();
    const now = new Date();

    const created = await this.callingRepo.createCallSession({
      id: callSessionId,
      conversationId: input.conversationId,
      callerUserId,
      calleeUserId: otherUserId,
      callType: input.callType,
      status: 'RINGING',
      startedAt: now,
      createdAt: now,
    });

    return {
      callSessionId: created.id,
      status: created.status,
      callerUserId: created.callerUserId,
      calleeUserId: created.calleeUserId,
      callType: created.callType,
      startedAt: created.startedAt.toISOString(),
    };
  }

  async endCall(userId: string, input: EndCallInput): Promise<EndCallResponseDto> {
    const session = await this.callingRepo.findCallSessionById(input.callSessionId);
    if (!session) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Call session not found',
      });
    }

    if (session.callerUserId !== userId && session.calleeUserId !== userId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You are not a participant in this call session',
      });
    }

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000)
    );

    const status = input.reason === 'DECLINED' ? 'DECLINED' : 'ENDED';

    await this.callingRepo.updateCallStatus(
      session.id,
      status,
      now,
      durationSeconds
    );

    return {
      success: true,
      callSessionId: session.id,
      durationSeconds,
    };
  }

  async getCallSession(userId: string, callSessionId: string): Promise<CallSessionDto> {
    const session = await this.callingRepo.findCallSessionById(callSessionId);
    if (!session) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Call session not found',
      });
    }

    if (session.callerUserId !== userId && session.calleeUserId !== userId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You are not a participant in this call session',
      });
    }

    return {
      id: session.id,
      conversationId: session.conversationId,
      callerUserId: session.callerUserId,
      calleeUserId: session.calleeUserId,
      callType: session.callType,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      durationSeconds: session.durationSeconds,
    };
  }
}
