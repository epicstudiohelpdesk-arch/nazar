import {
  pgTable,
  uuid,
  boolean,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { matches } from './matches.js';

/**
 * Post-Date Feedbacks Table ("We Met" Closed Loop)
 * Enables private post-date feedback after couples meet in real life.
 * Used for Gale-Shapley machine learning training and dead match pruning.
 */
export const postDateFeedbacks = pgTable(
  'post_date_feedbacks',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    didMeet: boolean('did_meet').notNull(),
    wouldSeeAgain: boolean('would_see_again'),
    sentimentTags: jsonb('sentiment_tags').$type<string[]>(),
    privateNotes: text('private_notes'),
    closeMatch: boolean('close_match').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_post_date_feedbacks_user_match').on(table.userId, table.matchId),
    index('idx_post_date_feedbacks_match_id').on(table.matchId),
    index('idx_post_date_feedbacks_user_id').on(table.userId),
  ]
);

export type PostDateFeedbackRow = typeof postDateFeedbacks.$inferSelect;
export type NewPostDateFeedbackRow = typeof postDateFeedbacks.$inferInsert;
