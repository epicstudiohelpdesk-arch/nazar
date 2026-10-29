import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import * as jose from 'jose';
import {
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApplePaymentProvider } from '../src/modules/payments/providers/apple-payment.provider.js';
import { GooglePaymentProvider } from '../src/modules/payments/providers/google-payment.provider.js';
import type { AppConfigService } from '../src/config/app-config.service.js';
import { AppLoggerService } from '../src/common/logging/app-logger.service.js';

describe('Gate 1C: Cryptographic Payment Verification (Apple StoreKit 2 & Google Play)', () => {
  let tmpDir: string;
  let appleLeafKeyPem: string;
  let appleLeafCertPem: string;
  let appleLeafCertB64: string;
  let attackerKeyPem: string;
  let attackerCertPem: string;
  let attackerCertB64: string;

  const mockLogger = {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    verbose: () => {},
  } as unknown as AppLoggerService;

  const makeConfig = (overrides: Partial<AppConfigService> = {}): AppConfigService =>
    ({
      appleBundleId: 'com.nazar.app',
      appleBillingEnvironment: 'Sandbox',
      googlePlayPackageName: 'com.nazar.app',
      googleJwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      billingAllowUnverifiedProviders: false,
      nodeEnv: 'test',
      ...overrides,
    }) as unknown as AppConfigService;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-1c-certs-'));

    // 1. Generate an Apple-branded EC prime256v1 certificate + key
    const appleKeyPath = path.join(tmpDir, 'apple_key.pem');
    const appleCertPath = path.join(tmpDir, 'apple_cert.pem');
    execSync(
      `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes ` +
        `-keyout "${appleKeyPath}" -out "${appleCertPath}" -days 1 ` +
        `-subj "/CN=Apple Worldwide Developer Relations Certification Authority" 2>/dev/null`
    );
    appleLeafKeyPem = fs.readFileSync(appleKeyPath, 'utf8');
    appleLeafCertPem = fs.readFileSync(appleCertPath, 'utf8');
    const appleCertObj = new crypto.X509Certificate(appleLeafCertPem);
    appleLeafCertB64 = appleCertObj.raw.toString('base64');

    // 2. Generate an untrusted Attacker EC certificate + key
    const attackerKeyPath = path.join(tmpDir, 'attacker_key.pem');
    const attackerCertPath = path.join(tmpDir, 'attacker_cert.pem');
    execSync(
      `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes ` +
        `-keyout "${attackerKeyPath}" -out "${attackerCertPath}" -days 1 ` +
        `-subj "/CN=Malicious Forgery Root Authority" 2>/dev/null`
    );
    attackerKeyPem = fs.readFileSync(attackerKeyPath, 'utf8');
    attackerCertPem = fs.readFileSync(attackerCertPath, 'utf8');
    const attackerCertObj = new crypto.X509Certificate(attackerCertPem);
    attackerCertB64 = attackerCertObj.raw.toString('base64');
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  async function createSignedJWS(
    payload: object,
    keyPem: string,
    certB64: string,
    headerOverrides: Record<string, unknown> = {}
  ): Promise<string> {
    const privateKey = await jose.importPKCS8(keyPem, 'ES256');
    return new jose.CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({
        alg: 'ES256',
        x5c: [certB64],
        ...headerOverrides,
      })
      .sign(privateKey);
  }

  describe('Apple StoreKit 2 JWS Cryptographic Verification', () => {
    it('successfully verifies authentic JWS signed by Apple certificate with ES256', async () => {
      const config = makeConfig();
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_tx_valid_001',
        originalTransactionId: 'apple_orig_001',
        productId: 'com.nazar.app.premium.monthly',
        bundleId: 'com.nazar.app',
        purchaseDate: Date.now(),
        expiresDate: Date.now() + 30 * 86400000,
      };

      const jws = await createSignedJWS(txPayload, appleLeafKeyPem, appleLeafCertB64);
      const verified = await provider.verifyAppleJWS<typeof txPayload>(jws);

      expect(verified.transactionId).toBe(txPayload.transactionId);
      expect(verified.productId).toBe(txPayload.productId);
      expect(verified.bundleId).toBe('com.nazar.app');
    });

    it('rejects tampered JWS payload (cryptographic integrity failure)', async () => {
      const config = makeConfig();
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_tx_tamper_001',
        originalTransactionId: 'apple_orig_001',
        productId: 'com.nazar.app.premium.monthly',
        bundleId: 'com.nazar.app',
      };

      const validJWS = await createSignedJWS(txPayload, appleLeafKeyPem, appleLeafCertB64);
      const parts = validJWS.split('.');

      // Alter payload bytes in the middle segment
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...txPayload, transactionId: 'apple_tx_FORGED_001' })
      ).toString('base64url');
      const tamperedJWS = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(provider.verifyAppleJWS(tamperedJWS)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects JWS signed by attacker key when presenting Apple cert in x5c (signature mismatch)', async () => {
      const config = makeConfig();
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_tx_forged_key',
        productId: 'com.nazar.app.premium.monthly',
      };

      // Attacker signs with their private key, but claims the certificate is Apple's in x5c
      const forgedJWS = await createSignedJWS(txPayload, attackerKeyPem, appleLeafCertB64);

      await expect(provider.verifyAppleJWS(forgedJWS)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects JWS when certificate does not belong to Apple in production', async () => {
      const config = makeConfig({ nodeEnv: 'production' });
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_tx_bad_cert',
        productId: 'com.nazar.app.premium.monthly',
      };

      const attackerJWS = await createSignedJWS(txPayload, attackerKeyPem, attackerCertB64);

      await expect(provider.verifyAppleJWS(attackerJWS)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects non-ES256 algorithm headers (defense against alg confusion)', async () => {
      const config = makeConfig();
      const provider = new ApplePaymentProvider(config, mockLogger);

      const fakeHeader = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
      const fakeBody = Buffer.from(JSON.stringify({ transactionId: '123' })).toString('base64url');
      const fakeJWS = `${fakeHeader}.${fakeBody}.`;

      await expect(provider.verifyAppleJWS(fakeJWS)).rejects.toThrow(BadRequestException);
    });

    it('verifies purchase with valid receiptData and confirms bundle ID matches', async () => {
      const config = makeConfig();
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_purchase_verified_99',
        originalTransactionId: 'apple_orig_99',
        productId: 'com.nazar.app.premium.monthly',
        bundleId: 'com.nazar.app',
        purchaseDate: Date.now(),
        expiresDate: Date.now() + 30 * 86400000,
        inAppOwnershipType: 'PURCHASED',
      };

      const receiptJWS = await createSignedJWS(txPayload, appleLeafKeyPem, appleLeafCertB64);

      const purchase = await provider.verifyPurchase({
        userId: 'usr_001',
        productId: 'com.nazar.app.premium.monthly',
        transactionId: txPayload.transactionId,
        receiptData: receiptJWS,
      });

      expect(purchase.provider).toBe('APPLE_APP_STORE');
      expect(purchase.providerTransactionId).toBe(txPayload.transactionId);
      expect(purchase.status).toBe('SUCCEEDED');
      expect(purchase.rawMetadata?.bundleId).toBe('com.nazar.app');
    });

    it('rejects purchase when bundle ID does not match app configuration', async () => {
      const config = makeConfig({ appleBundleId: 'com.nazar.app' });
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_spoofed_bundle',
        productId: 'com.nazar.app.premium.monthly',
        bundleId: 'com.othermalicious.app',
      };

      const receiptJWS = await createSignedJWS(txPayload, appleLeafKeyPem, appleLeafCertB64);

      await expect(
        provider.verifyPurchase({
          userId: 'usr_001',
          productId: 'com.nazar.app.premium.monthly',
          transactionId: txPayload.transactionId,
          receiptData: receiptJWS,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies webhook event with nested signedTransactionInfo', async () => {
      const config = makeConfig();
      const provider = new ApplePaymentProvider(config, mockLogger);

      const txPayload = {
        transactionId: 'apple_webhook_tx_101',
        originalTransactionId: 'apple_webhook_orig_101',
        productId: 'com.nazar.app.premium.monthly',
        bundleId: 'com.nazar.app',
        purchaseDate: Date.now(),
        expiresDate: Date.now() + 30 * 86400000,
      };

      const innerJWS = await createSignedJWS(txPayload, appleLeafKeyPem, appleLeafCertB64);

      const notificationPayload = {
        notificationType: 'DID_RENEW',
        subtype: 'BILLING_RECOVERY',
        signedDate: Date.now(),
        data: {
          bundleId: 'com.nazar.app',
          signedTransactionInfo: innerJWS,
        },
      };

      const outerJWS = await createSignedJWS(
        notificationPayload,
        appleLeafKeyPem,
        appleLeafCertB64
      );

      const webhookEvent = await provider.verifyWebhook({
        payload: { signedPayload: outerJWS },
        rawBody: JSON.stringify({ signedPayload: outerJWS }),
      });

      expect(webhookEvent.provider).toBe('APPLE_APP_STORE');
      expect(webhookEvent.eventType).toBe('RENEWAL');
      expect(webhookEvent.originalTransactionId).toBe(txPayload.originalTransactionId);
      expect(webhookEvent.transactionId).toBe(txPayload.transactionId);
      expect(webhookEvent.productId).toBe(txPayload.productId);
    });

    it('rejects webhook when bundle ID does not match configured bundle ID', async () => {
      const config = makeConfig({ appleBundleId: 'com.nazar.app' });
      const provider = new ApplePaymentProvider(config, mockLogger);

      const notificationPayload = {
        notificationType: 'DID_RENEW',
        data: {
          bundleId: 'com.attacker.app',
        },
      };

      const outerJWS = await createSignedJWS(
        notificationPayload,
        appleLeafKeyPem,
        appleLeafCertB64
      );

      await expect(
        provider.verifyWebhook({
          payload: { signedPayload: outerJWS },
          rawBody: JSON.stringify({ signedPayload: outerJWS }),
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Google Play Webhook & Purchase Verification', () => {
    it('verifies Google Play RTDN webhook with matching packageName', async () => {
      const config = makeConfig({ billingAllowUnverifiedProviders: true });
      const provider = new GooglePaymentProvider(config, mockLogger);

      const rtdnData = {
        packageName: 'com.nazar.app',
        eventTimeMillis: `${Date.now()}`,
        subscriptionNotification: {
          notificationType: 2, // RENEWED
          purchaseToken: 'play_token_xyz_123',
          subscriptionId: 'premium_monthly',
        },
      };

      const base64Data = Buffer.from(JSON.stringify(rtdnData)).toString('base64');

      const event = await provider.verifyWebhook({
        headers: {},
        payload: {
          message: {
            data: base64Data,
            messageId: 'msg_001',
          },
        },
        rawBody: JSON.stringify({ message: { data: base64Data } }),
      });

      expect(event.provider).toBe('GOOGLE_PLAY');
      expect(event.eventType).toBe('RENEWAL');
      expect(event.originalTransactionId).toBe('play_token_xyz_123');
      expect(event.productId).toBe('premium_monthly');
    });

    it('rejects Google Play RTDN notification when packageName does not match', async () => {
      const config = makeConfig({
        googlePlayPackageName: 'com.nazar.app',
        billingAllowUnverifiedProviders: true,
      });
      const provider = new GooglePaymentProvider(config, mockLogger);

      const rtdnData = {
        packageName: 'com.imposter.app',
        subscriptionNotification: {
          notificationType: 2,
          purchaseToken: 'tok_1',
          subscriptionId: 'sub_1',
        },
      };

      const base64Data = Buffer.from(JSON.stringify(rtdnData)).toString('base64');

      await expect(
        provider.verifyWebhook({
          headers: {},
          payload: {
            message: { data: base64Data },
          },
          rawBody: '',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects Google Play webhook with invalid Bearer JWT', async () => {
      const config = makeConfig();
      const provider = new GooglePaymentProvider(config, mockLogger);

      const rtdnData = { packageName: 'com.nazar.app' };
      const base64Data = Buffer.from(JSON.stringify(rtdnData)).toString('base64');

      await expect(
        provider.verifyWebhook({
          headers: { authorization: 'Bearer invalid.forged.jwt' },
          payload: { message: { data: base64Data } },
          rawBody: '',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('fails closed when Google webhook is unauthenticated and unverified processing is disabled', async () => {
      const config = makeConfig({ billingAllowUnverifiedProviders: false });
      const provider = new GooglePaymentProvider(config, mockLogger);

      const rtdnData = { packageName: 'com.nazar.app' };
      const base64Data = Buffer.from(JSON.stringify(rtdnData)).toString('base64');

      try {
        await provider.verifyWebhook({
          headers: {},
          payload: { message: { data: base64Data } },
          rawBody: '',
        });
        expect.unreachable('Should have failed closed');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it('fails closed when Google purchase verification is invoked without unverified opt-in', async () => {
      const config = makeConfig({ billingAllowUnverifiedProviders: false });
      const provider = new GooglePaymentProvider(config, mockLogger);

      try {
        await provider.verifyPurchase({
          userId: 'usr_001',
          productId: 'prod_1',
          transactionId: 'GPA.1234-5678',
        });
        expect.unreachable('Should have failed closed');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });
  });
});
