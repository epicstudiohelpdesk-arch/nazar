export interface IClock {
  now(): Date;
  nowMs(): number;
}

export const CLOCK_TOKEN = Symbol('IClock');
