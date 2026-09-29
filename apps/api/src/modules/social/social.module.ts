import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

// Repositories
import { PostsRepository } from './repositories/posts.repository.js';
import { POSTS_REPOSITORY_TOKEN } from './repositories/posts.repository.interface.js';
import { CommentsRepository } from './repositories/comments.repository.js';
import { COMMENTS_REPOSITORY_TOKEN } from './repositories/comments.repository.interface.js';
import { ReactionsRepository } from './repositories/reactions.repository.js';
import { REACTIONS_REPOSITORY_TOKEN } from './repositories/reactions.repository.interface.js';
import { CommunitiesRepository } from './repositories/communities.repository.js';
import { COMMUNITIES_REPOSITORY_TOKEN } from './repositories/communities.repository.interface.js';
import { EventsRepository } from './repositories/events.repository.js';
import { EVENTS_REPOSITORY_TOKEN } from './repositories/events.repository.interface.js';

// Services
import { SocialProfileEnricherService } from './services/social-profile-enricher.service.js';
import { PostsService } from './services/posts.service.js';
import { CommunitiesService } from './services/communities.service.js';
import { EventsService } from './services/events.service.js';

// Controllers
import { PostsController } from './controllers/posts.controller.js';
import { CommunitiesController } from './controllers/communities.controller.js';
import { EventsController } from './controllers/events.controller.js';

@Module({
  imports: [InfrastructureModule, forwardRef(() => SafetyModule), forwardRef(() => PaymentsModule)],
  controllers: [PostsController, CommunitiesController, EventsController],
  providers: [
    SocialProfileEnricherService,
    {
      provide: POSTS_REPOSITORY_TOKEN,
      useClass: PostsRepository,
    },
    {
      provide: COMMENTS_REPOSITORY_TOKEN,
      useClass: CommentsRepository,
    },
    {
      provide: REACTIONS_REPOSITORY_TOKEN,
      useClass: ReactionsRepository,
    },
    {
      provide: COMMUNITIES_REPOSITORY_TOKEN,
      useClass: CommunitiesRepository,
    },
    {
      provide: EVENTS_REPOSITORY_TOKEN,
      useClass: EventsRepository,
    },
    PostsService,
    CommunitiesService,
    EventsService,
  ],
  exports: [
    PostsService,
    CommunitiesService,
    EventsService,
    SocialProfileEnricherService,
    POSTS_REPOSITORY_TOKEN,
    COMMENTS_REPOSITORY_TOKEN,
    REACTIONS_REPOSITORY_TOKEN,
    COMMUNITIES_REPOSITORY_TOKEN,
    EVENTS_REPOSITORY_TOKEN,
  ],
})
export class SocialModule {}
