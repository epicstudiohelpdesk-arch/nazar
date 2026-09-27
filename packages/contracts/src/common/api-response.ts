import { z } from "zod";
import { apiErrorResponseSchema, type ApiErrorResponse } from "./errors.js";

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailureEnvelope {
  success: false;
  error: ApiErrorResponse;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.unknown()).optional(),
  });
}

export const failureResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorResponseSchema,
});
