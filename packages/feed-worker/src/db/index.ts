import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

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
  `);
}

export function createDatabase(dbPath: string): { db: DrizzleDB } {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  
  // Initialize schema on startup
  initializeSchema(sqlite);

  const db = drizzle(sqlite, { schema });
  return { db };
}

