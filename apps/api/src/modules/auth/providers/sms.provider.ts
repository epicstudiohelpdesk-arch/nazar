import { Injectable, Logger } from '@nestjs/common';

export interface ISmsProvider {
  sendOtp(phoneNumber: string, otp: string): Promise<void>;
  getLastOtp(phoneNumber: string): string | undefined;
  clear(): void;
}

export const SMS_PROVIDER_TOKEN = Symbol('ISmsProvider');

@Injectable()
export class MockSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);
  private readonly sentOtps = new Map<string, string>();

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    this.sentOtps.set(phoneNumber, otp);
    this.logger.debug(`[SMS Simulation] Dispatched OTP to ${phoneNumber}: [REDACTED IN LOGS]`);
  }

  getLastOtp(phoneNumber: string): string | undefined {
    return this.sentOtps.get(phoneNumber);
  }

  clear(): void {
    this.sentOtps.clear();
  }
}
