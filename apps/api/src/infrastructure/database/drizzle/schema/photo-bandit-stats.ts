import {
  pgTable,
  uuid,
  integer,
  doublePrecision,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { profileMedia } from './profile-media.js';

/**
 * Smart Photos Multi-Armed Bandit Statistics Table
 * Tracks impressions, like conversions, and computes UCB1 bandit scores
 * for dynamic photo optimization.
 */
export const photoBanditStats = pgTable(
  'photo_bandit_stats',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => profileMedia.id, { onDelete: 'cascade' }),
    impressions: integer('impressions').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    score: doublePrecision('score').notNull().default(0.0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_photo_bandit_user_media').on(table.userId, table.mediaId),
    index('idx_photo_bandit_user_score').on(table.userId, table.score),
  ]
);

export type PhotoBanditStatRow = typeof photoBanditStats.$inferSelect;
export type NewPhotoBanditStatRow = typeof photoBanditStats.$inferInsert;
