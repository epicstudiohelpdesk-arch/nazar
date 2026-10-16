import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { ChatController } from './chat.controller.js';
import { CallingController } from './controllers/calling.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ConversationsService } from './services/conversations.service.js';
import { MessagesService } from './services/messages.service.js';
import { CallingService } from './services/calling.service.js';
import { CallingRepository } from './repositories/calling.repository.js';
import { CONVERSATIONS_REPOSITORY_TOKEN } from './repositories/conversations.repository.interface.js';
import { ConversationsRepository } from './repositories/conversations.repository.js';
import { MESSAGES_REPOSITORY_TOKEN } from './repositories/messages.repository.interface.js';
import { MessagesRepository } from './repositories/messages.repository.js';

@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    ProfilesModule,
    MatchesModule,
    forwardRef(() => SafetyModule),
  ],
  controllers: [ChatController, CallingController],
  providers: [
    ChatGateway,
    ConversationsService,
    MessagesService,
    CallingService,
    CallingRepository,
    {
      provide: CONVERSATIONS_REPOSITORY_TOKEN,
      useClass: ConversationsRepository,
    },
    {
      provide: MESSAGES_REPOSITORY_TOKEN,
      useClass: MessagesRepository,
    },
  ],
  exports: [
    ConversationsService,
    MessagesService,
    CallingService,
    CallingRepository,
    CONVERSATIONS_REPOSITORY_TOKEN,
    MESSAGES_REPOSITORY_TOKEN,
    ChatGateway,
  ],
})
export class ChatModule {}
