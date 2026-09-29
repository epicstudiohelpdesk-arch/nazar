import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';

// Repositories
import { UserBlocksRepository } from './repositories/user-blocks.repository.js';
import { USER_BLOCKS_REPOSITORY_TOKEN } from './repositories/user-blocks.repository.interface.js';
import { ReportsRepository } from './repositories/reports.repository.js';
import { REPORTS_REPOSITORY_TOKEN } from './repositories/reports.repository.interface.js';
import { ModerationCasesRepository } from './repositories/moderation-cases.repository.js';
import { MODERATION_CASES_REPOSITORY_TOKEN } from './repositories/moderation-cases.repository.interface.js';
import { UserRestrictionsRepository } from './repositories/user-restrictions.repository.js';
import { USER_RESTRICTIONS_REPOSITORY_TOKEN } from './repositories/user-restrictions.repository.interface.js';

// Automation Extension Point
import {
  MODERATION_SIGNAL_PROVIDER_TOKEN,
  NoopModerationSignalProvider,
} from './automation/moderation-signal.interface.js';

// Services
import { SafetyEnforcementService } from './services/safety-enforcement.service.js';
import { BlockingService } from './services/blocking.service.js';
import { ReportingService } from './services/reporting.service.js';
import { ModerationService } from './services/moderation.service.js';

// Controllers
import { BlockingController } from './controllers/blocking.controller.js';
import { ReportingController } from './controllers/reporting.controller.js';

@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule), forwardRef(() => ProfilesModule)],
  controllers: [BlockingController, ReportingController],
  providers: [
    UserBlocksRepository,
    {
      provide: USER_BLOCKS_REPOSITORY_TOKEN,
      useClass: UserBlocksRepository,
    },
    ReportsRepository,
    {
      provide: REPORTS_REPOSITORY_TOKEN,
      useClass: ReportsRepository,
    },
    ModerationCasesRepository,
    {
      provide: MODERATION_CASES_REPOSITORY_TOKEN,
      useClass: ModerationCasesRepository,
    },
    UserRestrictionsRepository,
    {
      provide: USER_RESTRICTIONS_REPOSITORY_TOKEN,
      useClass: UserRestrictionsRepository,
    },
    NoopModerationSignalProvider,
    {
      provide: MODERATION_SIGNAL_PROVIDER_TOKEN,
      useClass: NoopModerationSignalProvider,
    },
    SafetyEnforcementService,
    BlockingService,
    ReportingService,
    ModerationService,
  ],
  exports: [
    SafetyEnforcementService,
    BlockingService,
    ReportingService,
    ModerationService,
    USER_BLOCKS_REPOSITORY_TOKEN,
    USER_RESTRICTIONS_REPOSITORY_TOKEN,
    REPORTS_REPOSITORY_TOKEN,
    MODERATION_CASES_REPOSITORY_TOKEN,
    MODERATION_SIGNAL_PROVIDER_TOKEN,
  ],
})
export class SafetyModule {}
