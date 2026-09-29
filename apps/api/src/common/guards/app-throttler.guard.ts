import { Injectable, HttpException, HttpStatus, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { ErrorCode } from '@platform/api-contracts';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Authenticated user tracker
    if (req.user?.userId) {
      return `usr_${req.user.userId}`;
    }
    // 2. Admin principal tracker
    if (req.admin?.adminId) {
      return `adm_${req.admin.adminId}`;
    }
    // 3. Client device identifier tracker
    const deviceId = req.headers?.['x-device-id'];
    if (typeof deviceId === 'string' && deviceId.trim().length > 0) {
      return `dev_${deviceId.trim()}`;
    }
    // 4. IP-based fallback (honoring X-Forwarded-For)
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const clientIp = forwarded.split(',')[0]?.trim();
      if (clientIp) return `ip_${clientIp}`;
    }
    return `ip_${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail
  ): Promise<void> {
    throw new HttpException(
      {
        code: ErrorCode.RATE_LIMITED,
        message: 'Rate limit exceeded. Please slow down your requests.',
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}
