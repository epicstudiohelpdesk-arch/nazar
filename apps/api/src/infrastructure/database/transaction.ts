import type { DrizzleDatabase } from './drizzle/client.js';

export type TransactionScope = Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0];

export interface ITransactionManager {
  withTransaction<T>(fn: (tx: DrizzleDatabase) => Promise<T>): Promise<T>;
}

export class DrizzleTransactionManager implements ITransactionManager {
  constructor(private readonly db: DrizzleDatabase) {}

  async withTransaction<T>(fn: (tx: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return fn(tx as unknown as DrizzleDatabase);
    });
  }
}
