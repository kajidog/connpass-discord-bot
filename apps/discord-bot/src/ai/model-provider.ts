import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AIProvider, ModelConfig, AIModelsConfig } from '@connpass-discord-bot/core';
import type { LanguageModel } from 'ai';

/**
 * 許可されたモデルかどうかをバリデーション
 */
export function validateModel(
  config: AIModelsConfig,
  provider: AIProvider,
  model: string
): boolean {
  const allowed = config.allowedModels[provider];
  return allowed?.includes(model) ?? false;
}

/**
 * プロバイダーとモデル名からモデルインスタンスを取得
 * @throws APIキーが設定されていない場合はエラー
 */
export function getModel(config: ModelConfig): LanguageModel {
  const { provider, model } = config;

  // APIキーの存在チェック
  if (!hasApiKey(provider)) {
    const envVarName = getApiKeyEnvVar(provider);
    throw new Error(
      `${provider} のAPIキーが設定されていません。環境変数 ${envVarName} を設定してください。`
    );
  }

  switch (provider) {
    case 'openai':
      return openai(model) as unknown as LanguageModel;
    case 'anthropic':
      return anthropic(model) as unknown as LanguageModel;
    case 'google':
      return google(model) as unknown as LanguageModel;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * プロバイダーに対応するAPIキーの環境変数名を取得
 */
function getApiKeyEnvVar(provider: AIProvider): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'google':
      return 'GOOGLE_GENERATIVE_AI_API_KEY';
    default:
      return 'UNKNOWN';
  }
}

/**
 * 設定ファイルのデフォルトパス
 */
const DEFAULT_CONFIG_PATH = './config/ai-models.json';

/**
 * デフォルトのAI設定（設定ファイルがない場合に使用）
 */
const DEFAULT_AI_CONFIG: AIModelsConfig = {
  agent: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  summarizer: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  allowedModels: {
    openai: ['gpt-5.2-pro', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1', 'claude-sonnet-4-0', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    google: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
};

/**
 * 設定ファイルを読み込み、バリデーションを実行
 * 設定ファイルがない場合はデフォルト設定を使用
 */
export function loadAIConfig(configPath?: string): AIModelsConfig {
  const path = configPath || process.env.AI_CONFIG_PATH || DEFAULT_CONFIG_PATH;
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    console.warn(`[AI Config] Config file not found: ${resolvedPath}, using defaults`);
    return structuredClone(DEFAULT_AI_CONFIG);
  }

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    const config: AIModelsConfig = JSON.parse(content);

    // バリデーション
    if (!validateModel(config, config.agent.provider, config.agent.model)) {
      throw new Error(
        `Invalid agent model: ${config.agent.provider}/${config.agent.model}. Check allowedModels in config.`
      );
    }
    if (!validateModel(config, config.summarizer.provider, config.summarizer.model)) {
      throw new Error(
        `Invalid summarizer model: ${config.summarizer.provider}/${config.summarizer.model}. Check allowedModels in config.`
      );
    }

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`[AI Config] Invalid JSON in config file: ${resolvedPath}`);
      console.warn('[AI Config] Using default config');
      return structuredClone(DEFAULT_AI_CONFIG);
    }
    throw error;
  }
}

/**
 * チャンネルごとのモデル設定を取得
 * チャンネル設定がない場合はグローバル設定を使用
 */
export function getModelConfigForChannel(
  config: AIModelsConfig,
  type: 'agent' | 'summarizer',
  channelConfig?: { agent?: ModelConfig; summarizer?: ModelConfig } | null
): ModelConfig {
  // チャンネル設定があればそれを優先
  if (channelConfig?.[type]) {
    return channelConfig[type]!;
  }

  // なければグローバル設定を使用
  return config[type];
}

/**
 * プロバイダーに対応するAPIキーが設定されているかチェック
 */
export function hasApiKey(provider: AIProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'google':
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    default:
      return false;
  }
}

/**
 * AI設定のシングルトンインスタンス
 */
let cachedConfig: AIModelsConfig | null = null;

/**
 * キャッシュされた設定を取得（初回のみファイル読み込み）
 */
export function getAIConfig(): AIModelsConfig {
  if (!cachedConfig) {
    cachedConfig = loadAIConfig();
  }
  return cachedConfig;
}

/**
 * 設定キャッシュをクリア（テスト用）
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
