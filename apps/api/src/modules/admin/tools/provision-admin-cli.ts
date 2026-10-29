import 'reflect-metadata';
import crypto from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module.js';
import { AppConfigService } from '../../../config/app-config.service.js';
import { AdminAuthService } from '../services/admin-auth.service.js';
import type { AdminRoleName } from '@platform/api-contracts';

/**
 * Gate 1A: Auditable first-administrator provisioning workflow.
 *
 * Replaces the removed boot-time seed account. This command is the ONLY
 * supported way to create administrative accounts, it never prints or stores
 * secrets beyond the single one-time password echo below, and it refuses to
 * run in staging/production unless the operator presents the environment's
 * configured ADMIN_PROVISIONING_TOKEN.
 *
 * Usage:
 *   pnpm admin:provision -- \
 *     --email=ops@example.com --first-name=Ada --last-name=Admin \
 *     --role=SUPER_ADMIN [--mfa] [--token=<ADMIN_PROVISIONING_TOKEN>]
 *
 * After provisioning, the operator must:
 *   1. Deliver the one-time password to the administrator out-of-band.
 *   2. Have the administrator complete MFA enrollment (required for login
 *      while ADMIN_MFA_REQUIRED is enforced in staging/production).
 *   3. Rotate ADMIN_PROVISIONING_TOKEN after the enrollment window closes.
 */

interface CliArgs {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  token?: string;
  mfa?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (const raw of argv) {
    const [key, value] = raw.replace(/^--/, '').split('=');
    switch (key) {
      case 'email':
        args.email = value;
        break;
      case 'first-name':
        args.firstName = value;
        break;
      case 'last-name':
        args.lastName = value;
        break;
      case 'role':
        args.role = value;
        break;
      case 'token':
        args.token = value;
        break;
      case 'mfa':
        args.mfa = true;
        break;
      default:
        break;
    }
  }
  return args;
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email || !args.firstName || !args.lastName || !args.role) {
    console.error(
      '[Provisioning] Missing required arguments: --email, --first-name, --last-name, --role'
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const configService = app.get(AppConfigService);
  const adminAuthService = app.get(AdminAuthService);

  const hardenedEnv = configService.nodeEnv === 'staging' || configService.nodeEnv === 'production';

  try {
    if (hardenedEnv) {
      const configuredToken = configService.adminProvisioningToken;
      if (!configuredToken) {
        throw new Error(
          'Refusing to provision: ADMIN_PROVISIONING_TOKEN is not configured for this environment. Set it out-of-band first, then retry.'
        );
      }
      if (!args.token || !timingSafeEquals(args.token, configuredToken)) {
        throw new Error(
          'Refusing to provision: --token does not match the configured ADMIN_PROVISIONING_TOKEN.'
        );
      }
    }

    const result = await adminAuthService.provisionAdmin({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      role: args.role as AdminRoleName,
      mfaEnabled: args.mfa ?? false,
    });

    console.log('[Provisioning] Administrative account created.');
    console.log(`  Email: ${result.email}`);
    console.log(`  Role:  ${result.role}`);
    console.log(`  Admin ID: ${result.adminUserId}`);
    if (result.oneTimePassword) {
      console.log('');
      console.log('  ONE-TIME PASSWORD (shown once, not recoverable):');
      console.log(`  ${result.oneTimePassword}`);
      console.log('');
      console.log(
        '  Deliver out-of-band and require rotation on first use. Do not commit or log this value.'
      );
    } else {
      console.log('  A custom password was supplied by the operator (not echoed).');
    }
    console.log(
      '  Note: while ADMIN_MFA_REQUIRED is enforced, this account cannot sign in until MFA enrollment is completed.'
    );
  } catch (err: unknown) {
    console.error('[Provisioning] Failed:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
