import { Injectable } from '@nestjs/common';
import { generateUuidV7, isValidUuidV7 } from '@platform/domain';
import type { IIdGenerator } from './id-generator.interface.js';

@Injectable()
export class UuidV7Generator implements IIdGenerator {
  generate(): string {
    return generateUuidV7();
  }

  isValid(id: string): boolean {
    return isValidUuidV7(id);
  }
}
