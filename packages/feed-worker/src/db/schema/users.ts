import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  discordUserId: text('discord_user_id').primaryKey(),
  connpassNickname: text('connpass_nickname').notNull(),
  registeredAt: text('registered_at').notNull(),
});
