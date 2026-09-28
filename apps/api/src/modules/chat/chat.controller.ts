import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import {
  ErrorCode,
  type ConversationListResponseDto,
  type ConversationDetailDto,
  type MessageListResponseDto,
  type SendMessageResponseDto,
  type MarkReadResponseDto,
  type SyncMessagesResponseDto,
} from '@platform/api-contracts';
import {
  sendMessageSchema,
  markReadSchema,
  getMessagesQuerySchema,
  getConversationsQuerySchema,
  syncMessagesQuerySchema,
  conversationIdParamSchema,
  type SendMessageInput,
} from '@platform/validation';
import { AuthGuard, type AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ConversationsService } from './services/conversations.service.js';
import { MessagesService } from './services/messages.service.js';

@ApiTags('Chat')
@Controller('v1/conversations')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService,
    @Inject(MessagesService)
    private readonly messagesService: MessagesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve paginated active conversations',
    description: 'Returns cursor-paginated conversations for the authenticated user, ordered by last activity.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items limit (1-50, default 20)' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Cursor token for pagination' })
  @ApiResponse({ status: 200, description: 'Conversations retrieved successfully' })
  async getConversations(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<ConversationListResponseDto> {
    const parseResult = getConversationsQuerySchema.safeParse({ limit, cursor });
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: parseResult.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.conversationsService.listConversations(user.userId, parseResult.data);
  }

  @Get(':conversationId')
  @ApiOperation({
    summary: 'Retrieve conversation details',
    description: 'Returns detail record and participant profile for a specific conversation.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'Conversation details retrieved successfully' })
  async getConversation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('conversationId') conversationId: string
  ): Promise<ConversationDetailDto> {
    const parseResult = conversationIdParamSchema.safeParse({ conversationId });
    if (!parseResult.success) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation ID format' },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.conversationsService.getConversationDetail(user.userId, parseResult.data.conversationId);
  }

  @Get(':conversationId/messages')
  @ApiOperation({
    summary: 'Retrieve cursor-paginated message history',
    description: 'Returns messages in reverse chronological order with delivery/read state indicators.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items limit (1-100, default 50)' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Cursor token for pagination' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getMessages(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ): Promise<MessageListResponseDto> {
    const paramParse = conversationIdParamSchema.safeParse({ conversationId });
    if (!paramParse.success) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation ID format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const queryParse = getMessagesQuerySchema.safeParse({ limit, cursor });
    if (!queryParse.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: queryParse.error.errors[0]?.message || 'Invalid query parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.messagesService.listMessages(
      user.userId,
      paramParse.data.conversationId,
      queryParse.data
    );
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message (REST fallback / authoritative)',
    description:
      'Persists a new message transactionally, updates conversation metadata, and creates an outbox event.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clientMessageId', 'body'],
      properties: {
        clientMessageId: { type: 'string', example: 'client-msg-uuid-123' },
        body: { type: 'string', example: 'Hello there!' },
        messageType: { type: 'string', enum: ['TEXT', 'IMAGE', 'SYSTEM'], default: 'TEXT' },
        metadata: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('conversationId') conversationId: string,
    @Body() body: SendMessageInput
  ): Promise<SendMessageResponseDto> {
    const paramParse = conversationIdParamSchema.safeParse({ conversationId });
    if (!paramParse.success) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation ID format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const bodyParse = sendMessageSchema.safeParse(body);
    if (!bodyParse.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyParse.error.errors[0]?.message || 'Invalid message payload',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.messagesService.sendMessage(
      user.userId,
      paramParse.data.conversationId,
      bodyParse.data
    );
  }

  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Advance read cursor for a conversation',
    description: 'Updates monotonic read receipt up to the specified message ID.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['messageId'],
      properties: {
        messageId: { type: 'string', example: '018f0000-0000-7000-8000-000000000001' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Read state updated successfully' })
  async markRead(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('conversationId') conversationId: string,
    @Body() body: { messageId?: string }
  ): Promise<MarkReadResponseDto> {
    const paramParse = conversationIdParamSchema.safeParse({ conversationId });
    if (!paramParse.success) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation ID format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const bodyParse = markReadSchema.safeParse(body);
    if (!bodyParse.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyParse.error.errors[0]?.message || 'Invalid message ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.messagesService.markAsRead(
      user.userId,
      paramParse.data.conversationId,
      bodyParse.data.messageId
    );
  }

  @Post(':conversationId/delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge message delivery for a conversation',
    description: 'Updates monotonic delivered receipt up to the specified message ID.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['messageId'],
      properties: {
        messageId: { type: 'string', example: '018f0000-0000-7000-8000-000000000001' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Delivery acknowledged successfully' })
  async markDelivered(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('conversationId') conversationId: string,
    @Body() body: { messageId?: string }
  ): Promise<{ success: boolean }> {
    const paramParse = conversationIdParamSchema.safeParse({ conversationId });
    if (!paramParse.success) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation ID format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const bodyParse = markReadSchema.safeParse(body);
    if (!bodyParse.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: bodyParse.error.errors[0]?.message || 'Invalid message ID',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    await this.messagesService.markAsDelivered(
      user.userId,
      paramParse.data.conversationId,
      bodyParse.data.messageId
    );

    return { success: true };
  }

  @Get(':conversationId/sync')
  @ApiOperation({
    summary: 'Synchronize missed messages upon reconnect',
    description: 'Returns missed messages since the last known message ID.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID' })
  @ApiQuery({ name: 'sinceMessageId', required: false, type: String, description: 'Last known message UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit (1-100, default 50)' })
  @ApiResponse({ status: 200, description: 'Missed messages synchronized successfully' })
  async syncMessages(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('conversationId') conversationId: string,
    @Query('sinceMessageId') sinceMessageId?: string,
    @Query('limit') limit?: string
  ): Promise<SyncMessagesResponseDto> {
    const paramParse = conversationIdParamSchema.safeParse({ conversationId });
    if (!paramParse.success) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid conversation ID format' },
        HttpStatus.BAD_REQUEST
      );
    }

    const queryParse = syncMessagesQuerySchema.safeParse({ sinceMessageId, limit });
    if (!queryParse.success) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: queryParse.error.errors[0]?.message || 'Invalid sync parameters',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.messagesService.syncMessages(
      user.userId,
      paramParse.data.conversationId,
      queryParse.data
    );
  }
}
