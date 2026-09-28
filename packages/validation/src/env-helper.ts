import type { z } from 'zod';

export function validateEnv<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  envSource: Record<string, unknown> = process.env
): z.infer<z.ZodObject<T>> {
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
