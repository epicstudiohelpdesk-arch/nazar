import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { ErrorCode } from '@platform/api-contracts';
import {
  TOKEN_SERVICE_TOKEN,
  type ITokenService,
} from '../auth/tokens/token.interface.js';
import {
  SESSION_REPOSITORY_TOKEN,
  type ISessionRepository,
} from '../auth/repositories/session.repository.js';
import type { AuthenticatedPrincipal } from '../../common/guards/auth.guard.js';
import { ConversationsService } from './services/conversations.service.js';
import { MessagesService } from './services/messages.service.js';
import { SafetyEnforcementService } from '../safety/services/safety-enforcement.service.js';
import { createRealtimeEvent } from './domain/chat.utils.js';
import type { SendMessageInput } from '@platform/validation';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  // Track ephemeral typing timers per socket ID
  private readonly typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService,
    @Inject(MessagesService)
    private readonly messagesService: MessagesService,
    @Inject(SafetyEnforcementService)
    private readonly safetyEnforcement: SafetyEnforcementService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null) ||
        (client.handshake.query?.token as string | undefined);

      if (!rawToken || typeof rawToken !== 'string') {
        this.logger.warn(`[WS] Connection rejected: missing auth token on socket ${client.id}`);
        client.emit('error', {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Missing or invalid authentication token',
        });
        client.disconnect();
        return;
      }

      // 1. Verify token cryptographic signature and expiration
      const payload = this.tokenService.verifyAccessToken(rawToken);

      // 2. Verify durable session lifecycle
      const session = await this.sessionRepository.findById(payload.sid);
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        this.logger.warn(`[WS] Connection rejected: session revoked or expired for user ${payload.sub}`);
        client.emit('error', {
          code: ErrorCode.SESSION_EXPIRED,
          message: 'Session revoked or expired',
        });
        client.disconnect();
        return;
      }

      // 3. Attach authenticated principal to socket data
      const principal: AuthenticatedPrincipal = {
        userId: payload.sub,
        sessionId: payload.sid,
        deviceId: payload.dev,
      };

      // 3.5. Enforce safety restrictions on WebSocket connection (Gate 09)
      await this.safetyEnforcement.assertCanLogin(principal.userId);

      client.data.user = principal;

      // 4. Join user's personal room for multi-device fanout (Requirement 18, 19)
      await client.join(`user:${principal.userId}`);

      this.logger.log(`[WS] Socket connected & authenticated: user=${principal.userId}, socket=${client.id}`);
      client.emit('authenticated', { userId: principal.userId });
    } catch (err: unknown) {
      const code =
        (err as any)?.response?.code ||
        (err as any)?.code ||
        ErrorCode.REALTIME_AUTH_FAILED;
      const message =
        (err as any)?.response?.message ||
        (err instanceof Error ? err.message : 'Authentication failure');
      this.logger.warn(`[WS] Handshake failed: ${message}`);
      client.emit('error', {
        code,
        message,
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const timer = this.typingTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(client.id);
    }
    const user = client.data?.user as AuthenticatedPrincipal | undefined;
    this.logger.log(`[WS] Socket disconnected: user=${user?.userId || 'anon'}, socket=${client.id}`);
  }

  @SubscribeMessage('join:conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const { otherUserId } = await this.conversationsService.assertConversationAccess(user.userId, data.conversationId);
      await this.safetyEnforcement.assertCanMessage(user.userId, otherUserId);
      await client.join(`conversation:${data.conversationId}`);
      return { success: true, conversationId: data.conversationId };
    } catch (err: unknown) {
      const message =
        (err as any)?.response?.message ||
        (err instanceof Error ? err.message : 'Access denied');
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('leave:conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ): Promise<{ success: boolean }> {
    await client.leave(`conversation:${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      clientMessageId: string;
      body: string;
      messageType?: 'TEXT' | 'IMAGE' | 'SYSTEM';
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const input: SendMessageInput = {
        clientMessageId: data.clientMessageId,
        body: data.body,
        messageType: data.messageType || 'TEXT',
        metadata: data.metadata,
      };

      const result = await this.messagesService.sendMessage(
        user.userId,
        data.conversationId,
        input
      );

      const { otherUserId } = await this.conversationsService.assertConversationAccess(
        user.userId,
        data.conversationId
      );

      const event = createRealtimeEvent(
        'message.created',
        result.message,
        data.conversationId
      );

      // Broadcast to active conversation room
      this.server.to(`conversation:${data.conversationId}`).emit('message.created', event);

      // Also fan out to the recipient's personal user room for list-level updates
      this.server.to(`user:${otherUserId}`).emit('message.created', event);

      return { success: true, data: result.message };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string }
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const result = await this.messagesService.markAsRead(
        user.userId,
        data.conversationId,
        data.messageId
      );

      const event = createRealtimeEvent(
        'message.read',
        result,
        data.conversationId
      );

      this.server.to(`conversation:${data.conversationId}`).emit('message.read', event);
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('message:delivered')
  async handleMarkDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string }
  ): Promise<{ success: boolean; error?: string }> {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.messagesService.markAsDelivered(
        user.userId,
        data.conversationId,
        data.messageId
      );

      const event = createRealtimeEvent(
        'message.delivered',
        {
          conversationId: data.conversationId,
          messageId: data.messageId,
          recipientUserId: user.userId,
        },
        data.conversationId
      );

      this.server.to(`conversation:${data.conversationId}`).emit('message.delivered', event);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark as delivered';
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ): Promise<{ success: boolean }> {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user) {
      return { success: false };
    }

    try {
      const { otherUserId } = await this.conversationsService.assertConversationAccess(user.userId, data.conversationId);
      await this.safetyEnforcement.assertCanMessage(user.userId, otherUserId);

      const event = createRealtimeEvent(
        'typing.started',
        {
          conversationId: data.conversationId,
          userId: user.userId,
          isTyping: true,
        },
        data.conversationId
      );

      // Broadcast to others in the conversation room
      client.to(`conversation:${data.conversationId}`).emit('typing.started', event);

      // Reset auto-clear timer (Requirement 26: ephemeral state automatically clears)
      const existingTimer = this.typingTimers.get(client.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        const stopEvent = createRealtimeEvent(
          'typing.stopped',
          {
            conversationId: data.conversationId,
            userId: user.userId,
            isTyping: false,
          },
          data.conversationId
        );
        client.to(`conversation:${data.conversationId}`).emit('typing.stopped', stopEvent);
        this.typingTimers.delete(client.id);
      }, 3000);

      this.typingTimers.set(client.id, timer);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ): Promise<{ success: boolean }> {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user) {
      return { success: false };
    }

    try {
      const timer = this.typingTimers.get(client.id);
      if (timer) {
        clearTimeout(timer);
        this.typingTimers.delete(client.id);
      }

      const event = createRealtimeEvent(
        'typing.stopped',
        {
          conversationId: data.conversationId,
          userId: user.userId,
          isTyping: false,
        },
        data.conversationId
      );

      client.to(`conversation:${data.conversationId}`).emit('typing.stopped', event);
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
