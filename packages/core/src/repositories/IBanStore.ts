import type { BannedUser } from '../domain/types.js';

/**
 * バン保存インターフェース
 */
export interface IBanStore {
  /**
   * バンを保存（作成または更新）
   */
  save(ban: BannedUser): Promise<void>;

  /**
   * バンを削除
   */
  delete(discordUserId: string): Promise<void>;

  /**
   * バンを取得
   */
  find(discordUserId: string): Promise<BannedUser | undefined>;

  /**
   * バン一覧を取得
   */
  list(): Promise<BannedUser[]>;
}
