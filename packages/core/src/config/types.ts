/**
 * 設定の検証結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * 検証エラー
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * アプリケーション設定
 */
export interface AppConfig {
  // 必須設定
  discordBotToken: string;
  connpassApiKey: string;

  // オプション設定（ストレージ）
  storageType: 'file' | 'sqlite';
  jobStoreDir: string;
  databaseUrl: string;

  // オプション設定（ログ）
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logDestination: 'console' | 'database' | 'both';

  // オプション設定（AI）
  enableAiAgent: boolean;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleGenerativeAiApiKey?: string;

  // オプション設定（通知）
  enableEventNotify: boolean;
  notifyCheckIntervalMs: number;
  defaultNotifyMinutesBefore: number;
}

/**
 * 環境変数からの生設定値
 */
export interface RawEnvConfig {
  DISCORD_BOT_TOKEN?: string;
  CONNPASS_API_KEY?: string;
  STORAGE_TYPE?: string;
  JOB_STORE_DIR?: string;
  DATABASE_URL?: string;
  LOG_LEVEL?: string;
  LOG_DESTINATION?: string;
  ENABLE_AI_AGENT?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  ENABLE_EVENT_NOTIFY?: string;
  NOTIFY_CHECK_INTERVAL_MS?: string;
  DEFAULT_NOTIFY_MINUTES_BEFORE?: string;
}
