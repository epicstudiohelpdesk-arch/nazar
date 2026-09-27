import { z } from "zod";

export enum ErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  PRECONDITION_FAILED = "PRECONDITION_FAILED",
  RATE_LIMITED = "RATE_LIMITED",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED",
  ACCOUNT_BANNED = "ACCOUNT_BANNED",
  AGE_RESTRICTION = "AGE_RESTRICTION",
  PROFILE_INCOMPLETE = "PROFILE_INCOMPLETE",
  LOCATION_REQUIRED = "LOCATION_REQUIRED",
  INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN",
  MEDIA_UPLOAD_FAILED = "MEDIA_UPLOAD_FAILED",
  UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE",
}

export const fieldValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

export type FieldValidationError = z.infer<typeof fieldValidationErrorSchema>;

export const apiErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
  details: z.array(fieldValidationErrorSchema).optional(),
  path: z.string().optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
