import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  doublePrecision,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import type { ProfileCompleteness } from '@platform/api-contracts';
import { users } from './users.js';

export const postgisPoint = customType<{
  data: { longitude: number; latitude: number };
  driverData: string;
}>({
  dataType() {
    return 'geography';
  },
  toDriver(val: { longitude: number; latitude: number }): string {
    return `SRID=4326;POINT(${val.longitude} ${val.latitude})`;
  },
  fromDriver(val: string): { longitude: number; latitude: number } {
    if (typeof val !== 'string') return val as any;
    const match = val.match(/POINT\(([-+]?[0-9]*\.?[0-9]+)\s+([-+]?[0-9]*\.?[0-9]+)\)/i);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
    }
    return val as any;
  },
});

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    dateOfBirth: date('date_of_birth').notNull(),
    gender: varchar('gender', { length: 32 }).notNull(),
    bio: text('bio'),
    occupation: varchar('occupation', { length: 128 }),
    education: varchar('education', { length: 128 }),
    city: varchar('city', { length: 128 }),
    countryCode: varchar('country_code', { length: 2 }),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    location: postgisPoint('location'),
    visibility: varchar('visibility', { length: 16 }).notNull().default('DRAFT'),
    completionStatus: jsonb('completion_status').notNull().$type<ProfileCompleteness>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_profiles_user_id').on(table.userId),
    index('idx_profiles_visibility').on(table.visibility),
    index('idx_profiles_location').using('gist', table.location),
  ]
);

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfileRow = typeof profiles.$inferInsert;
