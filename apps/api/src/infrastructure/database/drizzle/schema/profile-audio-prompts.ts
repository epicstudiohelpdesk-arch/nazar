import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';
import { profilePromptDefinitions } from './profile-prompt-definitions.js';

export const profileAudioPrompts = pgTable(
  'profile_audio_prompts',
  {
    id: uuid('id').primaryKey(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    promptDefinitionId: uuid('prompt_definition_id')
      .notNull()
      .references(() => profilePromptDefinitions.id, { onDelete: 'cascade' }),
    audioUrl: text('audio_url').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    waveformPeaks: jsonb('waveform_peaks'), // Array of float amplitudes [0.1, 0.4, 0.8, ...]
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_profile_audio_prompts_unique').on(table.profileId, table.promptDefinitionId),
    index('idx_profile_audio_prompts_profile_id').on(table.profileId),
  ]
);

export type ProfileAudioPromptRow = typeof profileAudioPrompts.$inferSelect;
export type NewProfileAudioPromptRow = typeof profileAudioPrompts.$inferInsert;
