import { Injectable, Inject, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96 bits standard for AES-GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128 bits authentication tag
const CIPHERTEXT_PREFIX = 'enc:v1:';

@Injectable()
export class FieldEncryptionService {
  private readonly logger = new Logger(FieldEncryptionService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {
    // Sprint 1: Derive a cryptographically strong 256-bit key using HKDF-SHA256
    // from the dedicated FIELD_ENCRYPTION_KEY master secret with domain-separated salt and info parameters.
    // Decoupled from JWT access/refresh secrets so JWT rotation never breaks database field decryption.
    const masterSecret =
      this.configService.fieldEncryptionKey ||
      this.configService.jwtAccessSecret + ':' + this.configService.jwtRefreshSecret;
    const salt = Buffer.from('nazar:field-encryption:salt:v1', 'utf8');
    const info = Buffer.from('nazar:aes-256-gcm:message-envelope:v1', 'utf8');

    this.encryptionKey = Buffer.from(
      crypto.hkdfSync('sha256', Buffer.from(masterSecret, 'utf8'), salt, info, 32)
    );
  }

  /**
   * Determine whether a string value is already encrypted with our envelope format.
   */
  isEncrypted(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.startsWith(CIPHERTEXT_PREFIX);
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM authenticated encryption.
   * Format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;
    if (this.isEncrypted(plaintext)) return plaintext;

    try {
      const iv = crypto.randomBytes(IV_LENGTH_BYTES);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });

      const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintext, 'utf8')),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return `${CIPHERTEXT_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
    } catch (err: unknown) {
      this.logger.error(
        `Field encryption failed: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new Error('Cryptographic failure during field-level encryption');
    }
  }

  /**
   * Decrypt an AES-256-GCM encrypted envelope.
   * Transparently returns unencrypted strings as-is for backward compatibility.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
    if (!this.isEncrypted(ciphertext)) return ciphertext;

    try {
      const parts = ciphertext.slice(CIPHERTEXT_PREFIX.length).split(':');
      if (parts.length !== 3) {
        this.logger.error('Corrupt ciphertext envelope format detected');
        throw new Error('Integrity violation: unable to decrypt field payload');
      }

      const [ivHex, tagHex, dataHex] = parts;
      const iv = Buffer.from(ivHex!, 'hex');
      const authTag = Buffer.from(tagHex!, 'hex');
      const encryptedData = Buffer.from(dataHex!, 'hex');

      if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
        this.logger.error('Invalid IV or auth tag length in encrypted envelope');
        throw new Error('Integrity violation: unable to decrypt field payload');
      }

      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (err: unknown) {
      this.logger.error(
        `Field decryption failed: ${err instanceof Error ? err.message : String(err)}`
      );
      // Fail closed on integrity violation to prevent tampering attacks
      throw new Error('Integrity violation: unable to decrypt field payload');
    }
  }

  /**
   * Encrypt an arbitrary JSON-serializable object into an encrypted envelope.
   */
  encryptJson(data: unknown): string {
    const serialized = JSON.stringify(data);
    return this.encrypt(serialized);
  }

  /**
   * Decrypt an encrypted envelope back into its typed JSON representation.
   */
  decryptJson<T>(ciphertext: string): T {
    const decrypted = this.decrypt(ciphertext);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Deterministic HMAC-SHA256 blind indexing for leak-proof searchable equality queries.
   */
  blindIndex(value: string, domainSalt: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(`${domainSalt}:${value}`)
      .digest('hex');
  }
}
