import type { Feed } from '../domain/types.js';

/**
 * フィード保存インターフェース
 */
export interface IFeedStore {
  /**
   * フィードを保存（作成または更新）
   */
  save(feed: Feed): Promise<void>;

  /**
   * フィードを削除
   */
  delete(feedId: string): Promise<void>;

  /**
   * フィードを取得
   */
  get(feedId: string): Promise<Feed | undefined>;

  /**
   * 全フィードを取得
   */
  list(): Promise<Feed[]>;
}
