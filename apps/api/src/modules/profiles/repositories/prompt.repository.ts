import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, asc, and } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  profilePromptDefinitions,
  profilePrompts,
  profileAudioPrompts,
  type ProfilePromptDefinitionRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import type {
  ProfilePromptItem,
  PromptAnswerInput,
  ProfileAudioPromptResponse,
  CreateAudioPromptRequest,
} from '@platform/api-contracts';

export interface IPromptRepository {
  findAllDefinitions(): Promise<ProfilePromptDefinitionRow[]>;
  findDefinitionByIds(ids: string[]): Promise<ProfilePromptDefinitionRow[]>;
  findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<ProfilePromptItem[]>;
  replaceProfilePrompts(
    profileId: string,
    prompts: readonly PromptAnswerInput[],
    tx?: DrizzleDatabase
  ): Promise<ProfilePromptItem[]>;
  findAudioPromptsByProfileId(
    profileId: string,
    tx?: DrizzleDatabase
  ): Promise<ProfileAudioPromptResponse[]>;
  createAudioPrompt(
    profileId: string,
    input: CreateAudioPromptRequest,
    tx?: DrizzleDatabase
  ): Promise<ProfileAudioPromptResponse>;
  deleteAudioPrompt(
    profileId: string,
    audioPromptId: string,
    tx?: DrizzleDatabase
  ): Promise<boolean>;
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

  async findAudioPromptsByProfileId(
    profileId: string,
    tx?: DrizzleDatabase
  ): Promise<ProfileAudioPromptResponse[]> {
    const rows = await this.getClient(tx)
      .select({
        id: profileAudioPrompts.id,
        promptDefinitionId: profileAudioPrompts.promptDefinitionId,
        prompt: profilePromptDefinitions.prompt,
        audioUrl: profileAudioPrompts.audioUrl,
        durationSeconds: profileAudioPrompts.durationSeconds,
        waveformPeaks: profileAudioPrompts.waveformPeaks,
        createdAt: profileAudioPrompts.createdAt,
      })
      .from(profileAudioPrompts)
      .innerJoin(
        profilePromptDefinitions,
        eq(profileAudioPrompts.promptDefinitionId, profilePromptDefinitions.id)
      )
      .where(eq(profileAudioPrompts.profileId, profileId))
      .orderBy(asc(profileAudioPrompts.createdAt));

    return rows.map((r) => ({
      id: r.id,
      promptDefinitionId: r.promptDefinitionId,
      prompt: r.prompt,
      audioUrl: r.audioUrl,
      durationSeconds: r.durationSeconds,
      waveformPeaks: (r.waveformPeaks as number[] | null) || null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createAudioPrompt(
    profileId: string,
    input: CreateAudioPromptRequest,
    tx?: DrizzleDatabase
  ): Promise<ProfileAudioPromptResponse> {
    const client = this.getClient(tx);
    const id = generateUuidV7();
    const now = new Date();

    const [inserted] = await client
      .insert(profileAudioPrompts)
      .values({
        id,
        profileId,
        promptDefinitionId: input.promptDefinitionId,
        audioUrl: input.audioUrl,
        durationSeconds: input.durationSeconds,
        waveformPeaks: (input.waveformPeaks as any) || null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [profileAudioPrompts.profileId, profileAudioPrompts.promptDefinitionId],
        set: {
          audioUrl: input.audioUrl,
          durationSeconds: input.durationSeconds,
          waveformPeaks: (input.waveformPeaks as any) || null,
          updatedAt: now,
        },
      })
      .returning();

    const defs = await this.findDefinitionByIds([input.promptDefinitionId]);
    const promptText = defs[0]?.prompt || '';

    return {
      id: inserted!.id,
      promptDefinitionId: inserted!.promptDefinitionId,
      prompt: promptText,
      audioUrl: inserted!.audioUrl,
      durationSeconds: inserted!.durationSeconds,
      waveformPeaks: (inserted!.waveformPeaks as number[] | null) || null,
      createdAt: inserted!.createdAt.toISOString(),
    };
  }

  async deleteAudioPrompt(
    profileId: string,
    audioPromptId: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .delete(profileAudioPrompts)
      .where(
        and(
          eq(profileAudioPrompts.id, audioPromptId),
          eq(profileAudioPrompts.profileId, profileId)
        )
      )
      .returning({ id: profileAudioPrompts.id });
    return result.length > 0;
  }
}
