import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema/index.js';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

/**
 * Run database migrations
 */
function runMigrations(sqlite: InstanceType<typeof Database>): void {
  // Migration: Add sent_at column to feed_sent_events if it doesn't exist
  const tableInfo = sqlite.prepare("PRAGMA table_info('feed_sent_events')").all() as Array<{ name: string }>;
  const hasSentAt = tableInfo.some((col) => col.name === 'sent_at');

  if (!hasSentAt) {
    // Add sent_at column with default value of current timestamp for existing rows
    sqlite.exec(`
      ALTER TABLE feed_sent_events ADD COLUMN sent_at TEXT NOT NULL DEFAULT '';
      UPDATE feed_sent_events SET sent_at = updated_at WHERE sent_at = '';
    `);
  }
}

/**
 * Initialize database schema (create tables if they don't exist)
 */
function initializeSchema(sqlite: InstanceType<typeof Database>): void {
  sqlite.exec(`
    -- feeds table
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      schedule TEXT NOT NULL,
      range_days INTEGER NOT NULL DEFAULT 14,
      keywords_and TEXT,
      keywords_or TEXT,
      location TEXT,
      hashtag TEXT,
      owner_nickname TEXT,
      "order" TEXT,
      min_participant_count INTEGER,
      min_limit INTEGER,
      use_ai INTEGER,
      last_run_at INTEGER,
      next_run_at INTEGER
    );

    -- feed_sent_events table
    CREATE TABLE IF NOT EXISTS feed_sent_events (
      feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (feed_id, event_id)
    );

    -- users table
    CREATE TABLE IF NOT EXISTS users (
      discord_user_id TEXT PRIMARY KEY,
      connpass_nickname TEXT NOT NULL,
      registered_at TEXT NOT NULL
    );

    -- admins table
    CREATE TABLE IF NOT EXISTS admins (
      discord_user_id TEXT PRIMARY KEY,
      added_at TEXT NOT NULL,
      added_by TEXT
    );

    -- banned_users table
    CREATE TABLE IF NOT EXISTS banned_users (
      discord_user_id TEXT PRIMARY KEY,
      banned_at TEXT NOT NULL,
      banned_by TEXT,
      reason TEXT
    );

    -- channel_model_configs table
    CREATE TABLE IF NOT EXISTS channel_model_configs (
      channel_id TEXT PRIMARY KEY,
      agent_provider TEXT,
      agent_model TEXT,
      summarizer_provider TEXT,
      summarizer_model TEXT
    );

    -- event_summary_cache table
    CREATE TABLE IF NOT EXISTS event_summary_cache (
      event_id INTEGER PRIMARY KEY,
      updated_at TEXT NOT NULL,
      summary TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    -- user_notify_settings table
    CREATE TABLE IF NOT EXISTS user_notify_settings (
      discord_user_id TEXT PRIMARY KEY REFERENCES users(discord_user_id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 0,
      minutes_before INTEGER NOT NULL DEFAULT 15,
      updated_at TEXT NOT NULL
    );

    -- user_notify_sent_events table
    CREATE TABLE IF NOT EXISTS user_notify_sent_events (
      discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL,
      notified_at TEXT NOT NULL,
      PRIMARY KEY (discord_user_id, event_id)
    );

    -- app_logs table
    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      level INTEGER NOT NULL,
      component TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT
    );

    -- action_logs table
    CREATE TABLE IF NOT EXISTS action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      level INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      component TEXT NOT NULL,
      message TEXT NOT NULL,
      user_id TEXT,
      guild_id TEXT,
      channel_id TEXT,
      before_state TEXT,
      after_state TEXT,
      metadata TEXT
    );

    -- Create indexes for efficient log queries
    CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
    CREATE INDEX IF NOT EXISTS idx_app_logs_component ON app_logs(component);
    CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_action_logs_action_type ON action_logs(action_type);
    CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
  `);
}

export function createDatabase(dbPath: string): { db: DrizzleDB } {
  // Ensure parent directory exists (better-sqlite3 doesn't create it)
  const dir = dirname(dbPath);
  if (dir && dir !== '.') {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');

  // Initialize schema on startup
  initializeSchema(sqlite);

  // Run migrations for existing databases
  runMigrations(sqlite);

  const db = drizzle(sqlite, { schema });
  return { db };
}
