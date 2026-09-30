import { Injectable, Logger } from '@nestjs/common';

export interface IEmailProvider {
  sendVerificationCode(email: string, code: string): Promise<void>;
  getLastCode(email: string): string | undefined;
  clear(): void;
}

export const EMAIL_PROVIDER_TOKEN = Symbol('IEmailProvider');

@Injectable()
export class MockEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);
  private readonly sentCodes = new Map<string, string>();

  async sendVerificationCode(email: string, code: string): Promise<void> {
    this.sentCodes.set(email, code);
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV AUTH] Verification Code for ${email}: ${code}`);
    } else {
      this.logger.debug(`[Email Simulation] Sent verification code to ${email}: [REDACTED IN LOGS]`);
    }
  }

  getLastCode(email: string): string | undefined {
    return this.sentCodes.get(email);
  }

  clear(): void {
    this.sentCodes.clear();
  }
}
