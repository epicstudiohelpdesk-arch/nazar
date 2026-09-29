import { io, type Socket } from 'socket.io-client';
import type {
  RealtimeEvent,
  MessageItemDto,
  MarkReadResponseDto,
  TypingEventPayload,
} from '@platform/api-contracts';

export type SocketConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export class ChatSocketManager {
  private socket: Socket | null = null;
  private connectionState: SocketConnectionState = 'disconnected';
  private connectionStateListeners: Set<(state: SocketConnectionState) => void> = new Set();
  private messageListeners: Set<(event: RealtimeEvent<MessageItemDto>) => void> = new Set();
  private readListeners: Set<(event: RealtimeEvent<MarkReadResponseDto>) => void> = new Set();
  private deliveryListeners: Set<
    (
      event: RealtimeEvent<{ conversationId: string; messageId: string; recipientUserId: string }>
    ) => void
  > = new Set();
  private typingListeners: Set<(event: RealtimeEvent<TypingEventPayload>) => void> = new Set();

  getConnectionState(): SocketConnectionState {
    return this.connectionState;
  }

  private setConnectionState(newState: SocketConnectionState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      for (const listener of this.connectionStateListeners) {
        listener(newState);
      }
    }
  }

  connect(baseUrl: string, accessToken: string): void {
    if (this.socket?.connected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.setConnectionState('connecting');

    const cleanBase = baseUrl.replace(/\/+$/, '');
    this.socket = io(`${cleanBase}/chat`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.setConnectionState('connected');
    });

    this.socket.on('disconnect', () => {
      this.setConnectionState('disconnected');
    });

    this.socket.on('reconnect_attempt', () => {
      this.setConnectionState('reconnecting');
    });

    this.socket.on('reconnect', () => {
      this.setConnectionState('connected');
    });

    this.socket.on('error', () => {
      this.setConnectionState('disconnected');
    });

    this.socket.on('message.created', (event: RealtimeEvent<MessageItemDto>) => {
      for (const listener of this.messageListeners) {
        listener(event);
      }
    });

    this.socket.on('message.read', (event: RealtimeEvent<MarkReadResponseDto>) => {
      for (const listener of this.readListeners) {
        listener(event);
      }
    });

    this.socket.on(
      'message.delivered',
      (
        event: RealtimeEvent<{ conversationId: string; messageId: string; recipientUserId: string }>
      ) => {
        for (const listener of this.deliveryListeners) {
          listener(event);
        }
      }
    );

    this.socket.on('typing.started', (event: RealtimeEvent<TypingEventPayload>) => {
      for (const listener of this.typingListeners) {
        listener(event);
      }
    });

    this.socket.on('typing.stopped', (event: RealtimeEvent<TypingEventPayload>) => {
      for (const listener of this.typingListeners) {
        listener(event);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnectionState('disconnected');
  }

  async joinConversation(conversationId: string): Promise<boolean> {
    if (!this.socket?.connected) {
      return false;
    }
    return new Promise((resolve) => {
      this.socket?.emit('join:conversation', { conversationId }, (res: { success: boolean }) => {
        resolve(res?.success ?? false);
      });
    });
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('leave:conversation', { conversationId });
  }

  startTyping(conversationId: string): void {
    this.socket?.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.socket?.emit('typing:stop', { conversationId });
  }

  onConnectionStateChange(listener: (state: SocketConnectionState) => void): () => void {
    this.connectionStateListeners.add(listener);
    return () => this.connectionStateListeners.delete(listener);
  }

  onMessageCreated(listener: (event: RealtimeEvent<MessageItemDto>) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onMessageRead(listener: (event: RealtimeEvent<MarkReadResponseDto>) => void): () => void {
    this.readListeners.add(listener);
    return () => this.readListeners.delete(listener);
  }

  onMessageDelivered(
    listener: (
      event: RealtimeEvent<{ conversationId: string; messageId: string; recipientUserId: string }>
    ) => void
  ): () => void {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  onTyping(listener: (event: RealtimeEvent<TypingEventPayload>) => void): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }
}

export const chatSocket = new ChatSocketManager();
