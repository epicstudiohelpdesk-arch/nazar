import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './services/matches.service.js';
import { MatchesRepository } from './repositories/matches.repository.js';
import { MATCHES_REPOSITORY_TOKEN } from './repositories/matches.repository.interface.js';

@Module({
  imports: [InfrastructureModule, AuthModule, ProfilesModule],
  controllers: [MatchesController],
  providers: [
    MatchesRepository,
    {
      provide: MATCHES_REPOSITORY_TOKEN,
      useClass: MatchesRepository,
    },
    MatchesService,
  ],
  exports: [MatchesService, MATCHES_REPOSITORY_TOKEN],
})
export class MatchesModule {}
