import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database.service.js';
import { users, type UserRow, type NewUserRow } from '../drizzle/schema/users.js';

export interface IUserRepository {
  findById(id: string): Promise<UserRow | null>;
  create(data: NewUserRow): Promise<UserRow>;
  update(id: string, data: Partial<NewUserRow>): Promise<UserRow | null>;
  softDelete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async findById(id: string): Promise<UserRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async create(data: NewUserRow): Promise<UserRow> {
    const rows = await this.databaseService.client.insert(users).values(data).returning();

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to insert user');
    }
    return row;
  }

  async update(id: string, data: Partial<NewUserRow>): Promise<UserRow | null> {
    const rows = await this.databaseService.client
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return rows[0] || null;
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.databaseService.client
      .update(users)
      .set({
        deletedAt: new Date(),
        status: 'DELETED',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return rows.length > 0;
  }

  async count(): Promise<number> {
    const res = await this.databaseService.client
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    return res[0]?.count ?? 0;
  }
}
