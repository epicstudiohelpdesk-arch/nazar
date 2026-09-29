import { Injectable, Inject, type LoggerService } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { RequestContextService } from '../context/request-context.service.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'auth',
  'secret',
  'otp',
  'code',
  'cookie',
  'accesstoken',
  'refreshtoken',
  'credential',
  'creditcard',
  'cvv',
  'cvc',
  'pan',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'secretkey',
  'secret_key',
  'sessiontoken',
  'idtoken',
  'clientsecret',
  'passkey',
  'assertion',
  'signature',
]);

const BEARER_REGEX = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_REGEX = /\bey[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\b/g;
const SECRET_KV_REGEX =
  /(password|secret|token|otp|code|api_?key|auth_?key)\s*[:=]\s*["']?([^"',&\s]+)["']?/gi;

export function redactSensitiveString(text: string): string {
  return text
    .replace(BEARER_REGEX, 'Bearer [REDACTED]')
    .replace(JWT_REGEX, '[REDACTED_JWT]')
    .replace(SECRET_KV_REGEX, '$1=[REDACTED]');
}

export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data === 'string') {
    return redactSensitiveString(data);
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else if (typeof value === 'string') {
      sanitized[key] = redactSensitiveString(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly appName: string;
  private readonly environment: string;
  private readonly minLevelPriority: number;

  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService
  ) {
    this.appName = this.config.appName;
    this.environment = this.config.nodeEnv;
    this.minLevelPriority = LOG_LEVEL_PRIORITY[this.config.logLevel] ?? 2;
  }

  private write(
    level: string,
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>
  ): void {
    const priority = LOG_LEVEL_PRIORITY[level] ?? 2;
    if (priority < this.minLevelPriority) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.appName,
      environment: this.environment,
      requestId: RequestContextService.currentRequestId,
      context: context ?? 'Application',
      message:
        typeof message === 'string' ? redactSensitiveString(message) : redactSensitiveData(message),
      ...(extra ? (redactSensitiveData(extra) as Record<string, unknown>) : {}),
    };

    const output = JSON.stringify(logEntry);
    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { stack: trace } : undefined);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
}
