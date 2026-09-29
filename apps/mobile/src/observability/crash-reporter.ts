export type CrashSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface Breadcrumb {
  readonly category: string;
  readonly message: string;
  readonly timestamp: string;
  readonly data?: Record<string, unknown>;
}

export interface CrashReport {
  readonly reportId: string;
  readonly release: string; // e.g. "nazar-mobile@1.0.0+10000"
  readonly environment: string; // "production" | "staging" | "development"
  readonly commitSha: string;
  readonly timestamp: string;
  readonly severity: CrashSeverity;
  readonly errorName: string;
  readonly errorMessage: string;
  readonly stackTrace?: string;
  readonly breadcrumbs: Breadcrumb[];
  readonly userContext?: {
    readonly userId?: string;
    readonly anonymousId?: string;
  };
  readonly deviceContext: {
    readonly platform: string;
    readonly osVersion?: string;
    readonly appVersion: string;
    readonly buildNumber: string;
  };
}

export interface CrashReporterOptions {
  readonly release: string;
  readonly environment: string;
  readonly commitSha?: string;
  readonly dsn?: string;
  readonly maxBreadcrumbs?: number;
  readonly platform?: 'ios' | 'android' | 'web';
  readonly appVersion?: string;
  readonly buildNumber?: string;
}

export class CrashReporter {
  private readonly release: string;
  private readonly environment: string;
  private readonly commitSha: string;
  private readonly dsn?: string;
  private readonly maxBreadcrumbs: number;
  private readonly platform: string;
  private readonly appVersion: string;
  private readonly buildNumber: string;

  private breadcrumbs: Breadcrumb[] = [];
  private capturedReports: CrashReport[] = [];
  private userContext: { userId?: string; anonymousId?: string } = {};

  constructor(options: CrashReporterOptions) {
    this.release = options.release;
    this.environment = options.environment;
    this.commitSha = options.commitSha || 'unknown-sha';
    this.dsn = options.dsn;
    this.maxBreadcrumbs = options.maxBreadcrumbs ?? 50;
    this.platform = options.platform ?? 'ios';
    this.appVersion = options.appVersion ?? '1.0.0';
    this.buildNumber = options.buildNumber ?? '10000';
  }

  getDsn(): string | undefined {
    return this.dsn;
  }

  setUser(userId?: string, anonymousId?: string): void {
    // Redaction invariant: Only pseudonymized IDs allowed, never PII (no phone, email, tokens)
    this.userContext = {
      ...(userId ? { userId } : {}),
      ...(anonymousId ? { anonymousId } : {}),
    };
  }

  clearUser(): void {
    this.userContext = {};
  }

  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    const crumb: Breadcrumb = {
      category,
      message,
      timestamp: new Date().toISOString(),
      ...(data ? { data } : {}),
    };

    if (this.breadcrumbs.length >= this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
    this.breadcrumbs.push(crumb);
  }

  captureException(error: Error | unknown, severity: CrashSeverity = 'error'): CrashReport {
    const err = error instanceof Error ? error : new Error(String(error));
    const reportId = `crash-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const report: CrashReport = {
      reportId,
      release: this.release,
      environment: this.environment,
      commitSha: this.commitSha,
      timestamp: new Date().toISOString(),
      severity,
      errorName: err.name || 'Error',
      errorMessage: err.message || 'Unknown error occurred',
      stackTrace: err.stack,
      breadcrumbs: [...this.breadcrumbs],
      userContext: { ...this.userContext },
      deviceContext: {
        platform: this.platform,
        appVersion: this.appVersion,
        buildNumber: this.buildNumber,
      },
    };

    this.capturedReports.push(report);
    return report;
  }

  captureMessage(message: string, severity: CrashSeverity = 'info'): CrashReport {
    return this.captureException(new Error(message), severity);
  }

  getReports(): readonly CrashReport[] {
    return this.capturedReports;
  }

  clearReports(): void {
    this.capturedReports = [];
    this.breadcrumbs = [];
  }
}

export function createProductionCrashReporter(): CrashReporter {
  return new CrashReporter({
    release: 'nazar-mobile@1.0.0+10000',
    environment:
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_ENV) || 'production',
    commitSha: process.env?.GIT_COMMIT_SHA || 'production-rc',
    dsn: process.env?.EXPO_PUBLIC_SENTRY_DSN,
    appVersion: '1.0.0',
    buildNumber: '10000',
  });
}
