/**
 * ログ読み取りインターフェース
 */

import type { ActionType, LogLevel } from '../logger/types.js';

/**
 * アクションログレコード（DBから読み取った形式）
 */
export interface ActionLogRecord {
  id: number;
  timestamp: number;
  level: LogLevel;
  actionType: ActionType;
  component: string;
  message: string;
  userId?: string;
  guildId?: string;
  channelId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * ログ読み取りオプション
 */
export interface LogReaderOptions {
  channelId?: string;
  guildId?: string;
  userId?: string;
  actionTypes?: ActionType[];
  level?: LogLevel;
  limit?: number;
  offset?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
}

/**
 * ログ読み取りインターフェース
 */
export interface ILogReader {
  /**
   * アクションログを取得
   */
  getActionLogs(options?: LogReaderOptions): Promise<ActionLogRecord[]>;

  /**
   * アクションログの件数を取得
   */
  countActionLogs(options?: Omit<LogReaderOptions, 'limit' | 'offset'>): Promise<number>;
}
