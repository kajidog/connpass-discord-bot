import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bannedUsers = sqliteTable('banned_users', {
  discordUserId: text('discord_user_id').primaryKey(),
  bannedAt: text('banned_at').notNull(),
  bannedBy: text('banned_by'),
  reason: text('reason'),
});
