import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import type { VerificationGesture } from '@platform/api-contracts';
import { users } from './users.js';

export const photoVerifications = pgTable(
  'photo_verifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gesture: varchar('gesture', { length: 32 }).notNull().$type<VerificationGesture>(),
    selfiePhotoUrl: text('selfie_photo_url').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('APPROVED'),
    challengeToken: varchar('challenge_token', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_photo_verifications_user_id').on(table.userId),
    index('idx_photo_verifications_status').on(table.status),
  ]
);

export type PhotoVerificationRow = typeof photoVerifications.$inferSelect;
export type NewPhotoVerificationRow = typeof photoVerifications.$inferInsert;
