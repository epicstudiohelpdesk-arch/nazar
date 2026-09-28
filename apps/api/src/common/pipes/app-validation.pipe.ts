import {
  type PipeTransform,
  Injectable,
  type ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';
import { ErrorCode, type FieldValidationError } from '@platform/api-contracts';

export class ValidationException extends BadRequestException {
  constructor(
    public readonly details: FieldValidationError[],
    message = 'Validation failed'
  ) {
    super({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      details,
    });
  }
}

function hasPrototypePollution(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
    Object.prototype.hasOwnProperty.call(obj, 'prototype')
  ) {
    return true;
  }
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'object' && val !== null && hasPrototypePollution(val)) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class AppValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Sanitize and protect against prototype pollution attack vectors
    if (hasPrototypePollution(value)) {
      throw new BadRequestException({
        code: ErrorCode.BAD_REQUEST,
        message: 'Prototype pollution detected in payload',
      });
    }

    const schemaToUse =
      this.schema ||
      (metadata.metatype && 'schema' in metadata.metatype
        ? (metadata.metatype as { schema: ZodSchema }).schema
        : undefined);

    if (!schemaToUse) {
      return value;
    }

    const result = schemaToUse.safeParse(value);
    if (!result.success) {
      const details = this.formatZodErrors(result.error);
      throw new ValidationException(details, 'Request payload failed schema validation');
    }

    return result.data;
  }

  private formatZodErrors(error: ZodError): FieldValidationError[] {
    return error.errors.map((err) => ({
      field: err.path.join('.') || 'payload',
      message: err.message,
      code: err.code,
    }));
  }
}
