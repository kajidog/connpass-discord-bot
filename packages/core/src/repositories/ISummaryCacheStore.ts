import type { EventSummaryCache } from '../domain/types.js';

/**
 * イベント要約キャッシュ保存インターフェース
 */
export interface ISummaryCacheStore {
  /**
   * キャッシュを保存
   */
  save(cache: EventSummaryCache): Promise<void>;

  /**
   * キャッシュを取得
   */
  get(eventId: number): Promise<EventSummaryCache | undefined>;

  /**
   * キャッシュを削除
   */
  delete(eventId: number): Promise<void>;

  /**
   * 古いキャッシュをクリア（オプション）
   * @param olderThanDays 指定日数より古いキャッシュを削除
   */
  cleanup?(olderThanDays: number): Promise<number>;
}
