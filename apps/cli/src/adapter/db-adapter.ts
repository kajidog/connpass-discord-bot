/**
 * CLIからDBへの接続アダプター
 */

import type { ILogReader } from '@connpass-discord-bot/core';
import { createDatabase, DrizzleLogReader } from '@connpass-discord-bot/feed-worker';

let logReader: DrizzleLogReader | null = null;

/**
 * DBパスを取得
 */
function getDbPath(): string {
  return process.env.DB_PATH || './data/connpass.db';
}

/**
 * LogReaderのシングルトンインスタンスを取得
 */
export function getLogReader(): ILogReader | null {
  if (logReader) {
    return logReader;
  }

  try {
    const dbPath = getDbPath();
    const { db } = createDatabase(dbPath);
    logReader = new DrizzleLogReader(db);
    return logReader;
  } catch (err) {
    // DBが存在しない場合などはnullを返す
    console.error('Failed to initialize log reader:', err);
    return null;
  }
}

/**
 * DB接続が利用可能かチェック
 */
export function isDbAvailable(): boolean {
  try {
    const reader = getLogReader();
    return reader !== null;
  } catch {
    return false;
  }
}
