import { Injectable, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';
import type {
  PasskeyRegisterOptionsResponse,
  PasskeyLoginOptionsResponse,
  PasskeyRegisterVerifyPayload,
  PasskeyLoginVerifyPayload,
} from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  passkeys,
  passkeyChallenges,
  type PasskeyRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';

@Injectable()
export class PasskeyService {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  generateChallenge(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  async createRegistrationOptions(
    userId: string,
    username = 'Nazar User'
  ): Promise<PasskeyRegisterOptionsResponse> {
    const challenge = this.generateChallenge();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.databaseService.client.insert(passkeyChallenges).values({
      id: generateUuidV7(),
      challenge,
      userId,
      purpose: 'registration',
      expiresAt,
    });

    return {
      challenge,
      rp: {
        id: this.configService.passkeyRpId,
        name: this.configService.passkeyRpName,
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      timeout: 60000,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    };
  }

  async verifyRegistration(
    userId: string,
    payload: PasskeyRegisterVerifyPayload
  ): Promise<PasskeyRow> {
    const db = this.databaseService.client;

    // 1. Validate challenge
    const [challengeRecord] = await db
      .select()
      .from(passkeyChallenges)
      .where(
        and(
          eq(passkeyChallenges.challenge, payload.challenge),
          eq(passkeyChallenges.purpose, 'registration')
        )
      )
      .limit(1);

    if (!challengeRecord) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Invalid passkey registration challenge',
      });
    }

    if (challengeRecord.consumedAt) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Passkey registration challenge has already been consumed',
      });
    }

    if (challengeRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Passkey registration challenge has expired',
      });
    }

    // 2. Consume challenge
    await db
      .update(passkeyChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(passkeyChallenges.id, challengeRecord.id));

    // 3. Prevent duplicate credential registration
    const [existing] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, payload.credentialId))
      .limit(1);

    if (existing) {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'Passkey credential already registered',
      });
    }

    // 4. Store credential
    const [created] = await db
      .insert(passkeys)
      .values({
        id: generateUuidV7(),
        userId,
        credentialId: payload.credentialId,
        publicKey: payload.publicKey,
        transports: payload.transports ? [...payload.transports] : undefined,
        aaguid: payload.aaguid,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to persist passkey credential');
    }

    return created;
  }

  async createLoginOptions(_emailOrPhone?: string): Promise<PasskeyLoginOptionsResponse> {
    const challenge = this.generateChallenge();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.databaseService.client.insert(passkeyChallenges).values({
      id: generateUuidV7(),
      challenge,
      purpose: 'authentication',
      expiresAt,
    });

    return {
      challenge,
      rpId: this.configService.passkeyRpId,
      timeout: 60000,
      userVerification: 'preferred',
    };
  }

  async verifyLogin(payload: PasskeyLoginVerifyPayload): Promise<PasskeyRow> {
    const db = this.databaseService.client;

    // 1. Validate challenge
    const [challengeRecord] = await db
      .select()
      .from(passkeyChallenges)
      .where(
        and(
          eq(passkeyChallenges.challenge, payload.challenge),
          eq(passkeyChallenges.purpose, 'authentication')
        )
      )
      .limit(1);

    if (!challengeRecord) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid passkey authentication challenge',
      });
    }

    if (challengeRecord.consumedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey authentication challenge has already been consumed',
      });
    }

    if (challengeRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey authentication challenge has expired',
      });
    }

    // 2. Consume challenge
    await db
      .update(passkeyChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(passkeyChallenges.id, challengeRecord.id));

    // 3. Find credential
    const [credential] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, payload.credentialId))
      .limit(1);

    if (!credential) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey credential not recognized',
      });
    }

    // 4. Update usage counter and lastUsedAt
    const [updated] = await db
      .update(passkeys)
      .set({
        counter: credential.counter + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(passkeys.id, credential.id))
      .returning();

    if (!updated) {
      throw new Error('Failed to update passkey usage counter');
    }

    return updated;
  }
}
