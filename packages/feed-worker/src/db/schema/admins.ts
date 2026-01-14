import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const admins = sqliteTable('admins', {
  discordUserId: text('discord_user_id').primaryKey(),
  addedAt: text('added_at').notNull(),
  addedBy: text('added_by'),
});
