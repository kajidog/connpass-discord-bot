import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * アプリケーションログテーブル
 */
export const appLogs = sqliteTable('app_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull(), // Unix timestamp in milliseconds
  level: integer('level').notNull(), // LogLevel enum value
  component: text('component').notNull(),
  message: text('message').notNull(),
  metadata: text('metadata'), // JSON string
});

/**
 * アクションログテーブル（重要な操作の追跡用）
 */
export const actionLogs = sqliteTable('action_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull(), // Unix timestamp in milliseconds
  level: integer('level').notNull(), // LogLevel enum value
  actionType: text('action_type').notNull(), // ActionType enum value
  component: text('component').notNull(),
  message: text('message').notNull(),
  userId: text('user_id'),
  guildId: text('guild_id'),
  channelId: text('channel_id'),
  beforeState: text('before_state'), // JSON string
  afterState: text('after_state'), // JSON string
  metadata: text('metadata'), // JSON string
});
