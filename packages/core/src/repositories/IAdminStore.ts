import type { AdminUser } from '../domain/types.js';

/**
 * 管理者保存インターフェース
 */
export interface IAdminStore {
  /**
   * 管理者を保存（作成または更新）
   */
  save(admin: AdminUser): Promise<void>;

  /**
   * 管理者を削除
   */
  delete(discordUserId: string): Promise<void>;

  /**
   * 管理者を取得
   */
  find(discordUserId: string): Promise<AdminUser | undefined>;

  /**
   * 管理者一覧を取得
   */
  list(): Promise<AdminUser[]>;
}
