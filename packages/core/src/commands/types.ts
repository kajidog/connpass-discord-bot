/**
 * CLI/TUI および Discord 両方で使用可能なコマンドインターフェース
 */

import type { FeedConfig } from '../domain/types.js';

/**
 * コマンド実行コンテキスト
 */
export interface CommandContext {
  channelId: string;
  userId: string;
  guildId?: string;
}

/**
 * コマンドレスポンス
 */
export interface CommandResponse {
  content: string;
  ephemeral?: boolean;
}

/**
 * /connpass feed set オプション
 */
export interface FeedSetOptions {
  schedule: string;
  keywordsAnd?: string;
  keywordsOr?: string;
  rangeDays?: number;
  location?: string;
  hashtag?: string;
  ownerNickname?: string;
  order?: FeedConfig['order'];
  minParticipants?: number;
  minLimit?: number;
  useAi?: boolean;
}

/**
 * スケジュールラベルのマッピング
 */
export const SCHEDULE_LABELS: Record<string, string> = {
  '0 9 * * *': '毎日 9:00',
  '0 12 * * *': '毎日 12:00',
  '0 18 * * *': '毎日 18:00',
  '0 9 * * 1-5': '平日 9:00',
  '0 9 * * 1': '毎週月曜 9:00',
  '0 18 * * 5': '毎週金曜 18:00',
};
