import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './services/interactions.service.js';
import { InteractionsRepository } from './repositories/interactions.repository.js';
import { INTERACTIONS_REPOSITORY_TOKEN } from './repositories/interactions.repository.interface.js';
import { InteractionExclusionService } from './services/interaction-exclusion.service.js';

@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    ProfilesModule,
    MatchesModule,
    forwardRef(() => SafetyModule),
  ],
  controllers: [InteractionsController],
  providers: [
    InteractionsRepository,
    {
      provide: INTERACTIONS_REPOSITORY_TOKEN,
      useClass: InteractionsRepository,
    },
    InteractionsService,
    InteractionExclusionService,
  ],
  exports: [InteractionsService, INTERACTIONS_REPOSITORY_TOKEN, InteractionExclusionService],
})
export class InteractionsModule {}
