import type {
  ModerationCaseRow,
  NewModerationCaseRow,
} from '../../../infrastructure/database/drizzle/schema/moderation-cases.js';
import type {
  ModerationCaseEventRow,
  NewModerationCaseEventRow,
} from '../../../infrastructure/database/drizzle/schema/moderation-case-events.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface IModerationCasesRepository {
  createCase(data: NewModerationCaseRow, tx?: DrizzleDatabase): Promise<ModerationCaseRow>;

  findOpenCaseBySubject(
    subjectUserId: string,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseRow | null>;

  findCaseById(caseId: string, tx?: DrizzleDatabase): Promise<ModerationCaseRow | null>;

  updateCase(
    caseId: string,
    data: Partial<Omit<ModerationCaseRow, 'id' | 'openedAt'>>,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseRow | null>;

  createCaseEvent(
    data: NewModerationCaseEventRow,
    tx?: DrizzleDatabase
  ): Promise<ModerationCaseEventRow>;

  findCaseEvents(caseId: string, tx?: DrizzleDatabase): Promise<readonly ModerationCaseEventRow[]>;
}

export const MODERATION_CASES_REPOSITORY_TOKEN = Symbol('IModerationCasesRepository');
