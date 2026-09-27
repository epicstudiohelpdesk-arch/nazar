import { z } from "zod";
import { uuidV7Schema } from "../common/id.js";

export enum MessageType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  VOICE = "VOICE",
  SYSTEM = "SYSTEM",
}

export const sendMessageRequestSchema = z.object({
  clientGeneratedId: uuidV7Schema,
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
  mediaUrl: z.string().url().optional(),
});

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const messageResponseSchema = z.object({
  id: uuidV7Schema,
  clientGeneratedId: uuidV7Schema,
  matchId: uuidV7Schema,
  senderId: uuidV7Schema,
  content: z.string(),
  type: z.nativeEnum(MessageType),
  mediaUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});

export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const markMessagesReadRequestSchema = z.object({
  lastReadMessageId: uuidV7Schema,
});

export type MarkMessagesReadRequest = z.infer<
  typeof markMessagesReadRequestSchema
>;

export enum WsClientEvent {
  JOIN_MATCH = "JOIN_MATCH",
  LEAVE_MATCH = "LEAVE_MATCH",
  SEND_MESSAGE = "SEND_MESSAGE",
  TYPING_START = "TYPING_START",
  TYPING_STOP = "TYPING_STOP",
  MARK_READ = "MARK_READ",
}

export enum WsServerEvent {
  NEW_MESSAGE = "NEW_MESSAGE",
  MESSAGE_READ = "MESSAGE_READ",
  USER_TYPING = "USER_TYPING",
  ERROR = "ERROR",
}

export const wsTypingPayloadSchema = z.object({
  matchId: uuidV7Schema,
  userId: uuidV7Schema,
  isTyping: z.boolean(),
});

export type WsTypingPayload = z.infer<typeof wsTypingPayloadSchema>;
