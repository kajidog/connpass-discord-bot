/**
 * CLIからDBへの接続アダプター
 */

import type { ILogReader } from '@connpass-discord-bot/core';
import { createDatabase, DrizzleLogReader } from '@connpass-discord-bot/feed-worker';
import { resolveStorageConfig } from './storage.js';

let logReader: DrizzleLogReader | null = null;

/**
 * DBパスを取得
 */
function getDatabaseUrl(): string {
  const { databaseUrl } = resolveStorageConfig();
  return databaseUrl;
}

/**
 * LogReaderのシングルトンインスタンスを取得
 */
export function getLogReader(): ILogReader | null {
  if (logReader) {
    return logReader;
  }

  try {
    const { storageType } = resolveStorageConfig();
    if (storageType !== 'sqlite') {
      return null;
    }

    const databaseUrl = getDatabaseUrl();
    const { db } = createDatabase(databaseUrl);
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
