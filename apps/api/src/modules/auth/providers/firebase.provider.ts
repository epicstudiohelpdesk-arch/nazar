import { Injectable, Inject, Logger, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorCode } from '@platform/api-contracts';
import { AppConfigService } from '../../../config/app-config.service.js';

export interface FirebaseIdentityResult {
  uid: string;
  phoneNumber?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
}

export const FIREBASE_AUTH_PROVIDER_TOKEN = Symbol('IFirebaseAuthProvider');

export interface IFirebaseAuthProvider {
  verifyIdToken(idToken: string): Promise<FirebaseIdentityResult>;
}

@Injectable()
export class FirebaseAuthProvider implements IFirebaseAuthProvider, OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthProvider.name);
  private app: App | null = null;

  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService
  ) {}

  onModuleInit(): void {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this.app = existingApps[0]!;
      return;
    }

    try {
      const candidatePaths = [
        this.configService.firebaseServiceAccountPath,
        path.resolve(process.cwd(), 'secrets/firebase-service-account.json'),
        path.resolve(process.cwd(), 'apps/api/secrets/firebase-service-account.json'),
        path.resolve(process.cwd(), '../api/secrets/firebase-service-account.json'),
        '/Users/subhamdas/Downloads/nazar-85664-firebase-adminsdk-fbsvc-f507fa6678.json',
      ].filter(Boolean) as string[];

      let credentialLoaded = false;
      for (const credPath of candidatePaths) {
        if (fs.existsSync(credPath)) {
          const raw = fs.readFileSync(credPath, 'utf-8');
          const sa = JSON.parse(raw);
          this.app = initializeApp({
            credential: cert(sa),
            projectId: sa.project_id || this.configService.firebaseProjectId,
          });
          this.logger.log(`Initialized Firebase Admin SDK using service account at: ${credPath}`);
          credentialLoaded = true;
          break;
        }
      }

      if (!credentialLoaded) {
        this.app = initializeApp({
          projectId: this.configService.firebaseProjectId,
        });
        this.logger.warn(
          `Initialized Firebase Admin SDK without explicit cert file (ProjectId: ${this.configService.firebaseProjectId})`
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.stack || err.message : String(err);
      const apps = getApps();
      if (apps.length > 0) {
        this.app = apps[0]!;
      } else {
        this.logger.error(`Failed to initialize Firebase Admin SDK: ${errMsg}`);
      }
    }
  }

  async verifyIdToken(idToken: string): Promise<FirebaseIdentityResult> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Firebase ID token is required',
      });
    }

    if (!this.app && getApps().length === 0) {
      this.initializeFirebase();
    }

    try {
      const decoded = await getAuth(this.app ?? undefined).verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        phoneNumber: decoded.phone_number,
        email: decoded.email ? decoded.email.toLowerCase() : undefined,
        emailVerified: Boolean(decoded.email_verified),
        name: decoded.name,
        picture: decoded.picture,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Firebase token verification failed: ${msg}`);
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: `Invalid or expired Firebase ID token: ${msg}`,
      });
    }
  }
}
