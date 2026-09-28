import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type { MediaStatus, MediaType } from '@platform/api-contracts';
import { users } from './users.js';
import { profiles } from './profiles.js';

export const profileMedia = pgTable(
  'profile_media',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    objectKey: varchar('object_key', { length: 255 }).notNull().unique(),
    mediaType: varchar('media_type', { length: 16 }).notNull().default('IMAGE').$type<MediaType>(),
    mimeType: varchar('mime_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('PENDING').$type<MediaStatus>(),
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes'),
    checksum: varchar('checksum', { length: 64 }),
    position: integer('position').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_profile_media_object_key').on(table.objectKey),
    index('idx_profile_media_profile_id').on(table.profileId),
    index('idx_profile_media_user_id').on(table.userId),
    index('idx_profile_media_status').on(table.status),
  ]
);

export type ProfileMediaRow = typeof profileMedia.$inferSelect;
export type NewProfileMediaRow = typeof profileMedia.$inferInsert;
