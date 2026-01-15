import type { ILogWriter, LogEntry, ActionLogEntry } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { appLogs, actionLogs } from '../../db/schema/index.js';

/**
 * SQLiteにログを保存するLogWriter
 */
export class DrizzleLogWriter implements ILogWriter {
  constructor(private db: DrizzleDB) {}

  write(entry: LogEntry): void {
    // 非同期で書き込み（エラーは無視）
    this.writeAsync(entry).catch(() => {
      // ログ書き込みエラーは無視
    });
  }

  writeAction(entry: ActionLogEntry): void {
    this.writeActionAsync(entry).catch(() => {
      // ログ書き込みエラーは無視
    });
  }

  private async writeAsync(entry: LogEntry): Promise<void> {
    await this.db.insert(appLogs).values({
      timestamp: entry.timestamp.getTime(),
      level: entry.level,
      component: entry.component,
      message: entry.message,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  }

  private async writeActionAsync(entry: ActionLogEntry): Promise<void> {
    await this.db.insert(actionLogs).values({
      timestamp: entry.timestamp.getTime(),
      level: entry.level,
      actionType: entry.actionType,
      component: entry.component,
      message: entry.message,
      userId: entry.userId ?? null,
      guildId: entry.guildId ?? null,
      channelId: entry.channelId ?? null,
      beforeState: entry.beforeState ? JSON.stringify(entry.beforeState) : null,
      afterState: entry.afterState ? JSON.stringify(entry.afterState) : null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  }
}
