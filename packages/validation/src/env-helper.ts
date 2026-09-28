import type { z } from 'zod';

export function validateEnv<TOutput>(
  schema: z.ZodType<TOutput, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  envSource: Record<string, unknown> = process.env
): TOutput {
  const result = schema.safeParse(envSource);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `[FATAL] Environment variable validation failed:\n${errorDetails}\nCheck your .env file or deployment secrets.`
    );
  }
  return result.data;
}
