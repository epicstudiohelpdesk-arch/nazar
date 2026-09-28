import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorCode } from '@platform/api-contracts';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        code: ErrorCode.RATE_LIMITED,
        message: 'Rate limit exceeded. Please slow down your requests.',
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}
