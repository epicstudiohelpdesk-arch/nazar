import { z } from 'zod';

export const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidV7Schema = z
  .string()
  .trim()
  .refine((val) => UUID_V7_REGEX.test(val), {
    message: 'Must be a valid RFC 9562 UUIDv7 string',
  })
  .brand<'UuidV7'>();

export type UuidV7 = z.infer<typeof uuidV7Schema>;
