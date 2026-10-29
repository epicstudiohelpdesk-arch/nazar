import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { generateUuidV7 } from '@platform/domain';
import {
  ErrorCode,
  type VerificationGesture,
  type VerificationChallengeResponseDto,
  type SubmitVerificationResponseDto,
  type VerificationStatusResponseDto,
} from '@platform/api-contracts';
import type { SubmitVerificationInput } from '@platform/validation';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { VerificationRepository } from '../repositories/verification.repository.js';

const GESTURE_PROMPTS: Record<VerificationGesture, string> = {
  HEAD_TURN_LEFT: 'Turn your head to your left and glance toward the camera.',
  HEAD_TURN_RIGHT: 'Turn your head to your right and smile naturally.',
  PEACE_SIGN: 'Hold up a peace sign (two fingers) next to your cheek.',
  SMILE: 'Give a bright, natural smile with your face fully visible.',
  THUMBS_UP: 'Give a clear thumbs-up gesture right next to your chin.',
};

const GESTURES: readonly VerificationGesture[] = [
  'HEAD_TURN_LEFT',
  'HEAD_TURN_RIGHT',
  'PEACE_SIGN',
  'SMILE',
  'THUMBS_UP',
];

// Gate 1A: the hard-coded fallback secret was removed. Challenge signing fails
// closed when VERIFICATION_SECRET is not explicitly configured. A local
// development default remains available only for development/test runs.
const DEV_ONLY_CHALLENGE_SECRET = 'nazar-local-dev-only-kyc-challenge-key';
const IS_LOCAL_ENV =
  (process.env.NODE_ENV ?? 'development') === 'development' || process.env.NODE_ENV === 'test';
const CHALLENGE_SECRET =
  process.env.VERIFICATION_SECRET ?? (IS_LOCAL_ENV ? DEV_ONLY_CHALLENGE_SECRET : undefined);

function requireChallengeSecret(): string {
  if (!CHALLENGE_SECRET) {
    throw new Error(
      '[SECURITY] VERIFICATION_SECRET is not configured. Liveness verification is disabled (fail-closed).'
    );
  }
  return CHALLENGE_SECRET;
}
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class VerificationService {
  constructor(
    @Inject(VerificationRepository)
    private readonly verificationRepo: VerificationRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  generateChallenge(userId: string): VerificationChallengeResponseDto {
    const randomIndex = Math.floor(Math.random() * GESTURES.length);
    const gesture = GESTURES[randomIndex] || 'SMILE';
    const expiresAtMs = Date.now() + TOKEN_TTL_MS;
    const expiresAt = new Date(expiresAtMs).toISOString();

    const payload = `${userId}:${gesture}:${expiresAtMs}`;
    const signature = createHmac('sha256', requireChallengeSecret()).update(payload).digest('hex');

    const challengeToken = `${payload}:${signature}`;

    return {
      challengeToken,
      gesture,
      gesturePrompt: GESTURE_PROMPTS[gesture],
      expiresAt,
    };
  }

  async verifyPhoto(
    userId: string,
    input: SubmitVerificationInput
  ): Promise<SubmitVerificationResponseDto> {
    const parts = input.challengeToken.split(':');
    if (parts.length !== 4) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid verification challenge token format',
      });
    }

    const [tokenUserId, tokenGesture, tokenExpiresMsStr, tokenSignature] = parts;
    const tokenExpiresMs = Number(tokenExpiresMsStr);

    if (tokenUserId !== userId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Challenge token does not belong to the authenticated user',
      });
    }

    if (Date.now() > tokenExpiresMs) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Verification challenge has expired. Please request a new pose.',
      });
    }

    const expectedSignature = createHmac('sha256', requireChallengeSecret())
      .update(`${tokenUserId}:${tokenGesture}:${tokenExpiresMsStr}`)
      .digest('hex');

    if (tokenSignature !== expectedSignature) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Challenge token signature verification failed',
      });
    }

    if (input.gesture !== tokenGesture) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Selfie gesture '${input.gesture}' does not match assigned challenge pose '${tokenGesture}'`,
      });
    }

    const verifiedAt = new Date();

    await this.databaseService.withTransaction(async (tx) => {
      await this.verificationRepo.createVerification(
        {
          id: generateUuidV7(),
          userId,
          gesture: input.gesture,
          selfiePhotoUrl: input.selfiePhotoUrl,
          challengeToken: input.challengeToken,
          status: 'APPROVED',
        },
        tx
      );

      await this.verificationRepo.markProfileVerified(userId, verifiedAt, tx);
    });

    return {
      success: true,
      isVerified: true,
      message:
        'Selfie pose verified successfully! Your profile has been granted the Verified badge.',
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  async getVerificationStatus(userId: string): Promise<VerificationStatusResponseDto> {
    const status = await this.verificationRepo.getProfileVerificationStatus(userId);
    return {
      isVerified: status.isVerified,
      verifiedAt: status.verifiedAt ? status.verifiedAt.toISOString() : null,
    };
  }
}
