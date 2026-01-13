import type { ChannelModelConfig } from '../ai/types.js';

/**
 * チャンネルごとのモデル設定を管理するストア
 */
export interface IChannelModelStore {
  /**
   * チャンネルのモデル設定を取得
   * @param channelId チャンネルID
   * @returns モデル設定（存在しない場合はnull）
   */
  get(channelId: string): Promise<ChannelModelConfig | null>;

  /**
   * チャンネルのモデル設定を保存
   * @param config モデル設定
   */
  save(config: ChannelModelConfig): Promise<void>;

  /**
   * チャンネルのモデル設定を削除
   * @param channelId チャンネルID
   */
  delete(channelId: string): Promise<void>;
}
