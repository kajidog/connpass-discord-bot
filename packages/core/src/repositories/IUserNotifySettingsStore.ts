/**
 * ユーザー通知設定
 */
export interface UserNotifySettings {
  discordUserId: string;
  enabled: boolean;
  minutesBefore: number;
  updatedAt: string;
}

/**
 * ユーザー通知設定ストアインターフェース
 */
export interface IUserNotifySettingsStore {
  /**
   * 設定を保存（作成または更新）
   */
  save(settings: UserNotifySettings): Promise<void>;

  /**
   * 設定を取得
   */
  find(discordUserId: string): Promise<UserNotifySettings | undefined>;

  /**
   * 通知が有効な全ユーザーを取得
   */
  listEnabled(): Promise<UserNotifySettings[]>;

  /**
   * 設定を削除
   */
  delete(discordUserId: string): Promise<void>;
}
