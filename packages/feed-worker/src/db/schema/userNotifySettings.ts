import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const userNotifySettings = sqliteTable('user_notify_settings', {
  discordUserId: text('discord_user_id')
    .primaryKey()
    .references(() => users.discordUserId, { onDelete: 'cascade' }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  minutesBefore: integer('minutes_before').notNull().default(15),
  updatedAt: text('updated_at').notNull(),
});
