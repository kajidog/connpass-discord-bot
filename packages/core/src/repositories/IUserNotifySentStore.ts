/**
 * 送信済み通知イベント
 */
export interface UserNotifySent {
  discordUserId: string;
  eventId: number;
  notifiedAt: string;
}

/**
 * ユーザー通知送信済みストアインターフェース
 */
export interface IUserNotifySentStore {
  /**
   * 送信済みとして記録
   */
  markSent(discordUserId: string, eventId: number): Promise<void>;

  /**
   * 送信済みかチェック
   */
  isSent(discordUserId: string, eventId: number): Promise<boolean>;

  /**
   * ユーザーの送信済みイベントIDリストを取得
   */
  getSentEventIds(discordUserId: string): Promise<number[]>;

  /**
   * 古いレコードを削除（クリーンアップ）
   * @param daysOld 何日以上古いレコードを削除するか
   * @returns 削除したレコード数
   */
  cleanupOlderThan(daysOld: number): Promise<number>;
}
