/**
 * フィード設定 - チャンネル毎に保存
 */
export interface FeedConfig {
  /** 一意のID（通常はchannelIdと同じ） */
  id: string;
  /** Discord チャンネルID */
  channelId: string;
  /** cron式スケジュール（例: "0 9 * * 1" = 毎週月曜9時） */
  schedule: string;
  /** 検索範囲日数（デフォルト: 14） */
  rangeDays: number;
  /** AND検索キーワード */
  keywordsAnd?: string[];
  /** OR検索キーワード */
  keywordsOr?: string[];
  /** 都道府県フィルタ */
  location?: string[];
  /** ハッシュタグフィルタ（#なし） */
  hashtag?: string;
  /** 主催者ニックネーム */
  ownerNickname?: string;
  /** ソート順 */
  order?: FeedOrder;
  /** AI機能を使用するか（後で実装） */
  useAi?: boolean;
}

export type FeedOrder = 'updated_desc' | 'started_asc' | 'started_desc';

/**
 * フィード実行状態
 */
export interface FeedState {
  /** 最終実行日時（Unix timestamp） */
  lastRunAt?: number;
  /** 次回実行日時（Unix timestamp） - cron式から計算 */
  nextRunAt?: number;
  /**
   * 送信済みイベントキャッシュ
   * key: eventId, value: updatedAt (ISO string)
   * 同じIDでもupdatedAtが新しければ再送信
   */
  sentEvents: Record<number, string>;
}

/**
 * フィード（設定 + 状態）
 */
export interface Feed {
  config: FeedConfig;
  state: FeedState;
}

/**
 * ユーザー登録情報
 */
export interface User {
  /** Discord ユーザーID */
  discordUserId: string;
  /** Connpass ニックネーム */
  connpassNickname: string;
  /** 登録日時（ISO string） */
  registeredAt: string;
}

/**
 * 新着イベント通知ペイロード
 */
export interface NewEventsPayload {
  feedId: string;
  channelId: string;
  events: ConnpassEvent[];
}

/**
 * Connpassイベント（@kajidog/connpass-api-clientのEvent型と互換）
 */
export interface ConnpassEvent {
  id: number;
  title: string;
  catchPhrase: string;
  description: string;
  url: string;
  imageUrl?: string;
  hashTag: string;
  startedAt: string;
  endedAt: string;
  limit?: number;
  participantCount: number;
  waitingCount: number;
  ownerNickname: string;
  ownerDisplayName: string;
  place?: string;
  address?: string;
  lat?: number;
  lon?: number;
  groupId?: number;
  groupTitle?: string;
  groupUrl?: string;
  updatedAt: string;
}

/**
 * APIのソート順マッピング
 */
export const ORDER_MAP: Record<FeedOrder, number> = {
  updated_desc: 1,
  started_asc: 2,
  started_desc: 3,
} as const;

/**
 * デフォルト値
 */
export const DEFAULTS = {
  RANGE_DAYS: 14,
  ORDER: 'started_asc' as FeedOrder,
} as const;

// ============================================
// AI Agent 関連の型定義
// ============================================

/**
 * イベント要約キャッシュ
 */
export interface EventSummaryCache {
  /** イベントID */
  eventId: number;
  /** イベントのupdatedAt（変更検知用） */
  updatedAt: string;
  /** AI生成要約 */
  summary: string;
  /** キャッシュ作成日時（ISO string） */
  cachedAt: string;
}

/**
 * イベント検索パラメータ
 */
export interface SearchEventsParams {
  /** キーワード検索 */
  keyword?: string;
  /** AND検索キーワード */
  keywordsAnd?: string[];
  /** OR検索キーワード */
  keywordsOr?: string[];
  /** 都道府県 */
  prefecture?: string;
  /** 開始日（YYYYMMDD） */
  ymdFrom?: string;
  /** 終了日（YYYYMMDD） */
  ymdTo?: string;
  /** 主催者ニックネーム */
  ownerNickname?: string;
  /** 取得件数 */
  count?: number;
  /** ソート順 */
  order?: FeedOrder;
}

/**
 * 日付範囲
 */
export interface DateRange {
  from: Date;
  to: Date;
}
