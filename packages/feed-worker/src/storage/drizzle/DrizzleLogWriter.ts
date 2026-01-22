import { lt } from 'drizzle-orm';
import type { ILogWriter, LogEntry, ActionLogEntry } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { appLogs, actionLogs } from '../../db/schema/index.js';

/**
 * SQLiteにログを保存するLogWriter
 */
export class DrizzleLogWriter implements ILogWriter {
  constructor(private db: DrizzleDB) {}

  /**
   * 指定日数より古いアプリログを削除
   * @param olderThanDays 削除対象の日数
   * @returns 削除された行数
   */
  async cleanupAppLogs(olderThanDays: number): Promise<number> {
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const result = await this.db
      .delete(appLogs)
      .where(lt(appLogs.timestamp, cutoffMs));
    return result.changes ?? 0;
  }

  /**
   * 指定日数より古いアクションログを削除
   * @param olderThanDays 削除対象の日数
   * @returns 削除された行数
   */
  async cleanupActionLogs(olderThanDays: number): Promise<number> {
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const result = await this.db
      .delete(actionLogs)
      .where(lt(actionLogs.timestamp, cutoffMs));
    return result.changes ?? 0;
  }

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
