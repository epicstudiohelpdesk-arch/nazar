import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { AuthSecurityService } from './services/auth-security.service.js';
import { TokenService } from './tokens/token.service.js';
import { TOKEN_SERVICE_TOKEN } from './tokens/token.interface.js';
import { MockSmsProvider, SMS_PROVIDER_TOKEN } from './providers/sms.provider.js';
import { MockEmailProvider, EMAIL_PROVIDER_TOKEN } from './providers/email.provider.js';
import {
  GoogleOAuthProvider,
  AppleOAuthProvider,
  GOOGLE_OAUTH_PROVIDER_TOKEN,
  APPLE_OAUTH_PROVIDER_TOKEN,
} from './providers/oauth.provider.js';
import { PasskeyService } from './providers/passkey.service.js';
import {
  UserIdentityRepository,
  USER_IDENTITY_REPOSITORY_TOKEN,
} from './repositories/user-identity.repository.js';
import { SessionRepository, SESSION_REPOSITORY_TOKEN } from './repositories/session.repository.js';
import { DeviceRepository, DEVICE_REPOSITORY_TOKEN } from './repositories/device.repository.js';
import {
  OtpChallengeRepository,
  OTP_CHALLENGE_REPOSITORY_TOKEN,
} from './repositories/otp-challenge.repository.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSecurityService,
    PasskeyService,
    AuthGuard,
    {
      provide: TOKEN_SERVICE_TOKEN,
      useClass: TokenService,
    },
    TokenService,
    {
      provide: SMS_PROVIDER_TOKEN,
      useClass: MockSmsProvider,
    },
    MockSmsProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useClass: MockEmailProvider,
    },
    MockEmailProvider,
    {
      provide: GOOGLE_OAUTH_PROVIDER_TOKEN,
      useClass: GoogleOAuthProvider,
    },
    GoogleOAuthProvider,
    {
      provide: APPLE_OAUTH_PROVIDER_TOKEN,
      useClass: AppleOAuthProvider,
    },
    AppleOAuthProvider,
    {
      provide: USER_IDENTITY_REPOSITORY_TOKEN,
      useClass: UserIdentityRepository,
    },
    UserIdentityRepository,
    {
      provide: SESSION_REPOSITORY_TOKEN,
      useClass: SessionRepository,
    },
    SessionRepository,
    {
      provide: DEVICE_REPOSITORY_TOKEN,
      useClass: DeviceRepository,
    },
    DeviceRepository,
    {
      provide: OTP_CHALLENGE_REPOSITORY_TOKEN,
      useClass: OtpChallengeRepository,
    },
    OtpChallengeRepository,
  ],
  exports: [
    AuthService,
    AuthSecurityService,
    PasskeyService,
    AuthGuard,
    TOKEN_SERVICE_TOKEN,
    TokenService,
    SMS_PROVIDER_TOKEN,
    MockSmsProvider,
    EMAIL_PROVIDER_TOKEN,
    MockEmailProvider,
    GOOGLE_OAUTH_PROVIDER_TOKEN,
    GoogleOAuthProvider,
    APPLE_OAUTH_PROVIDER_TOKEN,
    AppleOAuthProvider,
    USER_IDENTITY_REPOSITORY_TOKEN,
    UserIdentityRepository,
    SESSION_REPOSITORY_TOKEN,
    SessionRepository,
    DEVICE_REPOSITORY_TOKEN,
    DeviceRepository,
    OTP_CHALLENGE_REPOSITORY_TOKEN,
    OtpChallengeRepository,
  ],
})
export class AuthModule {}
