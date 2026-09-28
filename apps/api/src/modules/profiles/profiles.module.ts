import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller.js';
import { InterestsController } from './interests.controller.js';
import { PromptsController } from './prompts.controller.js';
import { ProfileService } from './services/profile.service.js';
import { MediaService } from './services/media.service.js';
import { ProfileRepository, PROFILE_REPOSITORY_TOKEN } from './repositories/profile.repository.js';
import {
  PreferencesRepository,
  PREFERENCES_REPOSITORY_TOKEN,
} from './repositories/preferences.repository.js';
import {
  InterestRepository,
  INTEREST_REPOSITORY_TOKEN,
} from './repositories/interest.repository.js';
import { PromptRepository, PROMPT_REPOSITORY_TOKEN } from './repositories/prompt.repository.js';
import { MediaRepository, MEDIA_REPOSITORY_TOKEN } from './repositories/media.repository.js';

@Module({
  controllers: [ProfilesController, InterestsController, PromptsController],
  providers: [
    ProfileRepository,
    {
      provide: PROFILE_REPOSITORY_TOKEN,
      useClass: ProfileRepository,
    },
    PreferencesRepository,
    {
      provide: PREFERENCES_REPOSITORY_TOKEN,
      useClass: PreferencesRepository,
    },
    InterestRepository,
    {
      provide: INTEREST_REPOSITORY_TOKEN,
      useClass: InterestRepository,
    },
    PromptRepository,
    {
      provide: PROMPT_REPOSITORY_TOKEN,
      useClass: PromptRepository,
    },
    MediaRepository,
    {
      provide: MEDIA_REPOSITORY_TOKEN,
      useClass: MediaRepository,
    },
    ProfileService,
    MediaService,
  ],
  exports: [
    ProfileService,
    MediaService,
    PROFILE_REPOSITORY_TOKEN,
    PREFERENCES_REPOSITORY_TOKEN,
    INTEREST_REPOSITORY_TOKEN,
    PROMPT_REPOSITORY_TOKEN,
    MEDIA_REPOSITORY_TOKEN,
  ],
})
export class ProfilesModule {}
