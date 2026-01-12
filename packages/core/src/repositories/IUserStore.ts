import type { User } from '../domain/types.js';

/**
 * ユーザー保存インターフェース
 */
export interface IUserStore {
  /**
   * ユーザーを保存（作成または更新）
   */
  save(user: User): Promise<void>;

  /**
   * ユーザーを削除
   */
  delete(discordUserId: string): Promise<void>;

  /**
   * ユーザーを取得
   */
  find(discordUserId: string): Promise<User | undefined>;
}
