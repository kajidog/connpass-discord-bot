/**
 * SQLiteからログを読み取るLogReader実装
 */

import { desc, eq, and, gte, lte, inArray, count } from 'drizzle-orm';
import type {
  ActionType,
  LogLevel,
  ILogReader,
  ActionLogRecord,
  LogReaderOptions,
} from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { actionLogs } from '../../db/schema/index.js';

/**
 * Drizzle ORMを使用したログ読み取り実装
 */
export class DrizzleLogReader implements ILogReader {
  constructor(private db: DrizzleDB) {}

  /**
   * アクションログを取得
   */
  async getActionLogs(options: LogReaderOptions = {}): Promise<ActionLogRecord[]> {
    const {
      channelId,
      guildId,
      userId,
      actionTypes,
      level,
      limit = 50,
      offset = 0,
      fromTimestamp,
      toTimestamp,
    } = options;

    // 条件を構築
    const conditions = [];

    if (channelId) {
      conditions.push(eq(actionLogs.channelId, channelId));
    }
    if (guildId) {
      conditions.push(eq(actionLogs.guildId, guildId));
    }
    if (userId) {
      conditions.push(eq(actionLogs.userId, userId));
    }
    if (actionTypes && actionTypes.length > 0) {
      conditions.push(inArray(actionLogs.actionType, actionTypes));
    }
    if (level !== undefined) {
      conditions.push(gte(actionLogs.level, level));
    }
    if (fromTimestamp) {
      conditions.push(gte(actionLogs.timestamp, fromTimestamp));
    }
    if (toTimestamp) {
      conditions.push(lte(actionLogs.timestamp, toTimestamp));
    }

    // クエリ実行
    const rows = await this.db
      .select()
      .from(actionLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(actionLogs.timestamp))
      .limit(limit)
      .offset(offset);

    // レコードを変換
    return rows.map((row) => this.mapRowToRecord(row));
  }

  /**
   * アクションログの件数を取得
   */
  async countActionLogs(
    options: Omit<LogReaderOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const {
      channelId,
      guildId,
      userId,
      actionTypes,
      level,
      fromTimestamp,
      toTimestamp,
    } = options;

    // 条件を構築
    const conditions = [];

    if (channelId) {
      conditions.push(eq(actionLogs.channelId, channelId));
    }
    if (guildId) {
      conditions.push(eq(actionLogs.guildId, guildId));
    }
    if (userId) {
      conditions.push(eq(actionLogs.userId, userId));
    }
    if (actionTypes && actionTypes.length > 0) {
      conditions.push(inArray(actionLogs.actionType, actionTypes));
    }
    if (level !== undefined) {
      conditions.push(gte(actionLogs.level, level));
    }
    if (fromTimestamp) {
      conditions.push(gte(actionLogs.timestamp, fromTimestamp));
    }
    if (toTimestamp) {
      conditions.push(lte(actionLogs.timestamp, toTimestamp));
    }

    // カウントクエリ実行
    const result = await this.db
      .select({ count: count() })
      .from(actionLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0]?.count ?? 0;
  }

  /**
   * DBの行をActionLogRecordに変換
   */
  private mapRowToRecord(row: typeof actionLogs.$inferSelect): ActionLogRecord {
    return {
      id: row.id,
      timestamp: row.timestamp,
      level: row.level as LogLevel,
      actionType: row.actionType as ActionType,
      component: row.component,
      message: row.message,
      userId: row.userId ?? undefined,
      guildId: row.guildId ?? undefined,
      channelId: row.channelId ?? undefined,
      beforeState: row.beforeState ? JSON.parse(row.beforeState) : undefined,
      afterState: row.afterState ? JSON.parse(row.afterState) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
