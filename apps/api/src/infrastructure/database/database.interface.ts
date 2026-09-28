export interface IUnitOfWork {
  start(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}

export interface IDatabaseService {
  readonly isConnected: boolean;
  createUnitOfWork(): Promise<IUnitOfWork>;
}

export const DATABASE_SERVICE_TOKEN = Symbol('IDatabaseService');
