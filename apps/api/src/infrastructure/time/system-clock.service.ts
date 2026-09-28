import { Injectable } from '@nestjs/common';
import type { IClock } from './clock.interface.js';

@Injectable()
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return Date.now();
  }
}
