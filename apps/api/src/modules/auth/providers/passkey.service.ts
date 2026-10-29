import { Injectable, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import crypto from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import { ErrorCode } from '@platform/api-contracts';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
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

/**
 * Gate 1B — WebAuthn / passkey verification.
 *
 * The previous implementation only parsed the client-supplied credential and
 * public key and trusted them verbatim; a caller could log in by supplying any
 * known credential ID with no signature at all. Verification is now performed
 * with @simplewebauthn/server:
 *
 *   - Registration: the attestation object and client data are cryptographically
 *     verified against the stored challenge, expected origin and RP ID, and the
 *     credential public key is extracted from the verified attestation (never
 *     from client input).
 *   - Authentication: the assertion signature is verified against the stored
 *     credential public key, with challenge, origin, RP ID, user-presence /
 *     user-verification flags and signature-counter checks enforced.
 *
 * All failure paths fail closed with generic messages and never echo token or
 * credential material.
 */
@Injectable()
export class PasskeyService {
  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private get expectedOrigins(): string[] {
    return this.configService.passkeyAllowedOrigins;
  }

  private get expectedRpId(): string {
    return this.configService.passkeyRpId;
  }

  private get requireUserVerification(): boolean {
    return this.configService.passkeyUserVerification === 'required';
  }

  generateChallenge(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  async createRegistrationOptions(
    userId: string,
    username = 'Nazar User'
  ): Promise<PasskeyRegisterOptionsResponse> {
    const ttlMs = this.configService.passkeyChallengeTtlSeconds * 1000;
    const attestationType =
      this.configService.passkeyAttestation === 'indirect'
        ? 'indirect'
        : this.configService.passkeyAttestation;
    const options = await generateRegistrationOptions({
      rpName: this.configService.passkeyRpName,
      rpID: this.expectedRpId,
      userID: new TextEncoder().encode(userId),
      userName: username,
      userDisplayName: username,
      attestationType: attestationType as 'none' | 'direct',
      authenticatorSelection: {
        residentKey: this.configService.passkeyResidentKey,
        userVerification: this.configService.passkeyUserVerification,
      },
      timeout: ttlMs,
    });

    const challenge = options.challenge;
    const expiresAt = new Date(Date.now() + ttlMs);

    // Store the challenge bound to the user and purpose so it cannot be
    // replayed against a different account or flow.
    await this.databaseService.client.insert(passkeyChallenges).values({
      id: generateUuidV7(),
      challenge,
      userId,
      purpose: 'registration',
      expiresAt,
    });

    return {
      challenge,
      rp: { id: options.rp.id ?? this.expectedRpId, name: options.rp.name },
      user: {
        id: userId,
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams.map((p) => ({
        alg: p.alg,
        type: 'public-key' as const,
      })),
      timeout: options.timeout ?? ttlMs,
      attestation: options.attestation as 'none' | 'indirect' | 'direct' | undefined,
      authenticatorSelection: {
        residentKey: options.authenticatorSelection?.residentKey,
        userVerification: options.authenticatorSelection?.userVerification,
      },
    };
  }

  async createLoginOptions(
    emailOrPhone?: string,
    userId?: string
  ): Promise<PasskeyLoginOptionsResponse> {
    void emailOrPhone;
    const ttlMs = this.configService.passkeyChallengeTtlSeconds * 1000;
    const options = await generateAuthenticationOptions({
      rpID: this.expectedRpId,
      userVerification: this.configService.passkeyUserVerification,
      timeout: ttlMs,
    });

    const challenge = options.challenge;
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.databaseService.client.insert(passkeyChallenges).values({
      id: generateUuidV7(),
      challenge,
      userId: userId ?? null,
      purpose: 'authentication',
      expiresAt,
    });

    return {
      challenge,
      rpId: options.rpId ?? this.expectedRpId,
      timeout: options.timeout ?? ttlMs,
      userVerification: options.userVerification ?? this.configService.passkeyUserVerification,
      allowCredentials: options.allowCredentials?.map((c) => ({
        id: c.id,
        type: 'public-key' as const,
        transports: c.transports,
      })),
    };
  }

  /**
   * Atomically consumes a challenge. The conditional UPDATE guarantees
   * single use even under concurrent requests (only one caller can flip
   * consumed_at from NULL).
   */
  private async consumeChallenge(
    challenge: string,
    purpose: 'registration' | 'authentication'
  ): Promise<{ id: string; userId: string | null }> {
    const db = this.databaseService.client;
    const now = new Date();

    const [row] = await db
      .select()
      .from(passkeyChallenges)
      .where(
        and(eq(passkeyChallenges.challenge, challenge), eq(passkeyChallenges.purpose, purpose))
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey challenge is invalid or has expired',
      });
    }

    if (row.expiresAt < now) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey challenge is invalid or has expired',
      });
    }

    const consumed = await db
      .update(passkeyChallenges)
      .set({ consumedAt: now })
      .where(and(eq(passkeyChallenges.id, row.id), isNull(passkeyChallenges.consumedAt)))
      .returning({ id: passkeyChallenges.id });

    if (!consumed || consumed.length === 0) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey challenge is invalid or has expired',
      });
    }

    return { id: row.id, userId: row.userId };
  }

  async verifyRegistration(
    userId: string,
    payload: PasskeyRegisterVerifyPayload
  ): Promise<PasskeyRow> {
    const db = this.databaseService.client;

    // 1. Locate and atomically consume the challenge (single use).
    const challengeRecord = await this.consumeChallenge(payload.challenge, 'registration');

    // 2. The challenge must be bound to the requesting account.
    if (challengeRecord.userId !== userId) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Passkey registration challenge does not belong to this account',
      });
    }

    // 3. Perform full cryptographic verification of the attestation response.
    const response: RegistrationResponseJSON = {
      id: payload.id,
      rawId: payload.rawId ?? payload.id,
      type: 'public-key',
      response: {
        clientDataJSON: payload.response.clientDataJSON,
        attestationObject: payload.response.attestationObject,
      },
      clientExtensionResults: payload.clientExtensionResults ?? {},
      authenticatorAttachment: payload.authenticatorAttachment as
        'cross-platform' | 'platform' | undefined,
    };

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: this.expectedOrigins,
        expectedRPID: this.expectedRpId,
        requireUserVerification: this.requireUserVerification,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Passkey registration could not be verified',
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Passkey registration could not be verified',
      });
    }

    const info = verification.registrationInfo;
    const credentialId = info.credential.id;
    const publicKey = Buffer.from(info.credential.publicKey).toString('base64url');

    // 4. Credential uniqueness (a credential ID may belong to only one account).
    const [existing] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, credentialId))
      .limit(1);

    if (existing) {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'Passkey credential is already registered',
      });
    }

    // 5. Persist the VERIFIED credential material.
    const [created] = await db
      .insert(passkeys)
      .values({
        id: generateUuidV7(),
        userId,
        credentialId,
        publicKey,
        counter: info.credential.counter ?? 0,
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        transports: payload.transports ? [...payload.transports] : undefined,
        aaguid: info.aaguid,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to persist passkey credential');
    }

    return created;
  }

  async verifyLogin(payload: PasskeyLoginVerifyPayload): Promise<PasskeyRow> {
    const db = this.databaseService.client;

    // 1. Locate and atomically consume the challenge (single use).
    await this.consumeChallenge(payload.challenge, 'authentication');

    // 2. Resolve the stored credential.
    const [credential] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, payload.id))
      .limit(1);

    if (!credential) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey credential is not recognized',
      });
    }

    // 3. Verify the assertion signature against the STORED public key.
    const webauthnCredential: WebAuthnCredential = {
      id: credential.credentialId,
      publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
      counter: credential.counter,
      transports: credential.transports ?? undefined,
    };

    const response: AuthenticationResponseJSON = {
      id: payload.id,
      rawId: payload.rawId ?? payload.id,
      type: 'public-key',
      response: {
        clientDataJSON: payload.response.clientDataJSON,
        authenticatorData: payload.response.authenticatorData,
        signature: payload.response.signature,
        userHandle: payload.response.userHandle,
      },
      clientExtensionResults: payload.clientExtensionResults ?? {},
    };

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: this.expectedOrigins,
        expectedRPID: this.expectedRpId,
        credential: webauthnCredential,
        requireUserVerification: this.requireUserVerification,
      });
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey authentication could not be verified',
      });
    }

    if (!verification.verified) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey authentication could not be verified',
      });
    }

    const authInfo = verification.authenticationInfo;

    // 4. Signature counter must not go backwards (clone detection). The
    //    library rejects counter regressions for multi-device credentials.
    if (authInfo.newCounter <= credential.counter && credential.counter > 0) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey authentication could not be verified',
      });
    }

    // 5. Persist the new counter / device flags.
    const [updated] = await db
      .update(passkeys)
      .set({
        counter: authInfo.newCounter,
        lastUsedAt: new Date(),
        backedUp: authInfo.credentialBackedUp,
        deviceType: authInfo.credentialDeviceType,
      })
      .where(eq(passkeys.id, credential.id))
      .returning();

    if (!updated) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Passkey authentication could not be verified',
      });
    }

    return updated;
  }
}
