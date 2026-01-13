/**
 * AIプロバイダーの種類
 */
export type AIProvider = 'openai' | 'anthropic' | 'google';

/**
 * モデル設定
 */
export interface ModelConfig {
  provider: AIProvider;
  model: string;
}

/**
 * AI設定ファイルの構造
 */
export interface AIModelsConfig {
  /** エージェント用モデル設定 */
  agent: ModelConfig;
  /** 要約用モデル設定 */
  summarizer: ModelConfig;
  /** 許可されたモデルのリスト (プロバイダーごと) */
  allowedModels: Record<AIProvider, string[]>;
}

/**
 * チャンネルごとのモデル設定
 */
export interface ChannelModelConfig {
  /** チャンネルID */
  channelId: string;
  /** エージェント用モデル設定 */
  agent?: ModelConfig;
  /** 要約用モデル設定 */
  summarizer?: ModelConfig;
}
