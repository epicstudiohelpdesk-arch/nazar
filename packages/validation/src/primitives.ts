import { z } from 'zod';

export const sanitizedStringSchema = z.string().trim().min(1, 'Cannot be empty');

export const standardEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address');

export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(E164_PHONE_REGEX, 'Must be a valid E.164 phone number');

export const safeUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine(
    (url) => url.startsWith('https://') || url.startsWith('http://localhost'),
    'URL must use HTTPS protocol (or localhost for development)'
  );
