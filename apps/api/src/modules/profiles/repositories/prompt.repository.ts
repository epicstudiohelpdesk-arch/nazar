import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, asc } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  profilePromptDefinitions,
  profilePrompts,
  type ProfilePromptDefinitionRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import type { ProfilePromptItem, PromptAnswerInput } from '@platform/api-contracts';

export interface IPromptRepository {
  findAllDefinitions(): Promise<ProfilePromptDefinitionRow[]>;
  findDefinitionByIds(ids: string[]): Promise<ProfilePromptDefinitionRow[]>;
  findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<ProfilePromptItem[]>;
  replaceProfilePrompts(
    profileId: string,
    prompts: readonly PromptAnswerInput[],
    tx?: DrizzleDatabase
  ): Promise<ProfilePromptItem[]>;
}

export const PROMPT_REPOSITORY_TOKEN = Symbol('IPromptRepository');

@Injectable()
export class PromptRepository implements IPromptRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findAllDefinitions(): Promise<ProfilePromptDefinitionRow[]> {
    return this.databaseService.client
      .select()
      .from(profilePromptDefinitions)
      .where(eq(profilePromptDefinitions.status, 'ACTIVE'))
      .orderBy(asc(profilePromptDefinitions.sortOrder));
  }

  async findDefinitionByIds(ids: string[]): Promise<ProfilePromptDefinitionRow[]> {
    if (ids.length === 0) return [];
    return this.databaseService.client
      .select()
      .from(profilePromptDefinitions)
      .where(inArray(profilePromptDefinitions.id, ids));
  }

  async findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<ProfilePromptItem[]> {
    const rows = await this.getClient(tx)
      .select({
        id: profilePrompts.id,
        promptDefinitionId: profilePrompts.promptDefinitionId,
        prompt: profilePromptDefinitions.prompt,
        answer: profilePrompts.answer,
        position: profilePrompts.position,
      })
      .from(profilePrompts)
      .innerJoin(
        profilePromptDefinitions,
        eq(profilePrompts.promptDefinitionId, profilePromptDefinitions.id)
      )
      .where(eq(profilePrompts.profileId, profileId))
      .orderBy(asc(profilePrompts.position));

    return rows;
  }

  async replaceProfilePrompts(
    profileId: string,
    inputs: readonly PromptAnswerInput[],
    tx?: DrizzleDatabase
  ): Promise<ProfilePromptItem[]> {
    const client = this.getClient(tx);

    // 1. Delete existing
    await client.delete(profilePrompts).where(eq(profilePrompts.profileId, profileId));

    // 2. Insert new
    if (inputs.length > 0) {
      const newRows = inputs.map((item, idx) => ({
        id: generateUuidV7(),
        profileId,
        promptDefinitionId: item.promptDefinitionId,
        answer: item.answer,
        position: item.position ?? idx,
      }));
      await client.insert(profilePrompts).values(newRows);
    }

    // 3. Return updated list
    return this.findByProfileId(profileId, tx);
  }
}
