import type { AppConfig, RawEnvConfig, ValidationResult, ValidationError } from './types.js';

/**
 * 設定のデフォルト値
 */
export const CONFIG_DEFAULTS = {
  storageType: 'file' as const,
  jobStoreDir: './data',
  logLevel: 'info' as const,
  logDestination: 'console' as const,
  enableAiAgent: true,
  enableEventNotify: true,
  notifyCheckIntervalMs: 60000,
  defaultNotifyMinutesBefore: 10,
};

/**
 * 設定の制約
 */
export const CONFIG_CONSTRAINTS = {
  notifyCheckIntervalMs: { min: 10000, max: 3600000 },
  defaultNotifyMinutesBefore: { min: 1, max: 1440 },
};

/**
 * 有効なストレージタイプ
 */
const VALID_STORAGE_TYPES = ['file', 'sqlite'] as const;

/**
 * 有効なログレベル
 */
const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

/**
 * 有効なログ出力先
 */
const VALID_LOG_DESTINATIONS = ['console', 'database', 'both'] as const;

/**
 * 文字列を真偽値にパース
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return defaultValue;
}

/**
 * 文字列を正の整数にパース
 */
export function parsePositiveInt(
  value: string | undefined,
  defaultValue: number,
  constraints?: { min?: number; max?: number }
): { value: number; error?: string } {
  if (value === undefined || value === '') {
    return { value: defaultValue };
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return { value: defaultValue, error: `Invalid integer: "${value}"` };
  }

  if (parsed <= 0) {
    return { value: defaultValue, error: `Value must be positive: ${parsed}` };
  }

  if (constraints?.min !== undefined && parsed < constraints.min) {
    return { value: defaultValue, error: `Value must be >= ${constraints.min}: ${parsed}` };
  }

  if (constraints?.max !== undefined && parsed > constraints.max) {
    return { value: defaultValue, error: `Value must be <= ${constraints.max}: ${parsed}` };
  }

  return { value: parsed };
}

/**
 * 環境変数から設定を検証・パース
 */
export function validateConfig(env: RawEnvConfig): ValidationResult & { config?: AppConfig } {
  const errors: ValidationError[] = [];

  // 必須項目のチェック
  if (!env.DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN.trim() === '') {
    errors.push({
      field: 'DISCORD_BOT_TOKEN',
      message: 'Required environment variable is missing',
    });
  }

  if (!env.CONNPASS_API_KEY || env.CONNPASS_API_KEY.trim() === '') {
    errors.push({
      field: 'CONNPASS_API_KEY',
      message: 'Required environment variable is missing',
    });
  }

  // ストレージタイプの検証
  let storageType: 'file' | 'sqlite' = CONFIG_DEFAULTS.storageType;
  if (env.STORAGE_TYPE) {
    const normalized = env.STORAGE_TYPE.toLowerCase().trim();
    if (!VALID_STORAGE_TYPES.includes(normalized as typeof VALID_STORAGE_TYPES[number])) {
      errors.push({
        field: 'STORAGE_TYPE',
        message: `Invalid storage type. Must be one of: ${VALID_STORAGE_TYPES.join(', ')}`,
        value: env.STORAGE_TYPE,
      });
    } else {
      storageType = normalized as 'file' | 'sqlite';
    }
  }

  // ログレベルの検証
  let logLevel: 'debug' | 'info' | 'warn' | 'error' = CONFIG_DEFAULTS.logLevel;
  if (env.LOG_LEVEL) {
    const normalized = env.LOG_LEVEL.toLowerCase().trim();
    if (!VALID_LOG_LEVELS.includes(normalized as typeof VALID_LOG_LEVELS[number])) {
      errors.push({
        field: 'LOG_LEVEL',
        message: `Invalid log level. Must be one of: ${VALID_LOG_LEVELS.join(', ')}`,
        value: env.LOG_LEVEL,
      });
    } else {
      logLevel = normalized as 'debug' | 'info' | 'warn' | 'error';
    }
  }

  // ログ出力先の検証
  let logDestination: 'console' | 'database' | 'both' = CONFIG_DEFAULTS.logDestination;
  if (env.LOG_DESTINATION) {
    const normalized = env.LOG_DESTINATION.toLowerCase().trim();
    if (!VALID_LOG_DESTINATIONS.includes(normalized as typeof VALID_LOG_DESTINATIONS[number])) {
      errors.push({
        field: 'LOG_DESTINATION',
        message: `Invalid log destination. Must be one of: ${VALID_LOG_DESTINATIONS.join(', ')}`,
        value: env.LOG_DESTINATION,
      });
    } else {
      logDestination = normalized as 'console' | 'database' | 'both';
    }
  }

  // DB要求機能の整合性チェック
  if (storageType !== 'sqlite') {
    if (logDestination === 'database' || logDestination === 'both') {
      errors.push({
        field: 'LOG_DESTINATION',
        message: 'Database logging requires STORAGE_TYPE=sqlite',
        value: logDestination,
      });
    }
  }

  // 数値パラメータの検証
  const notifyIntervalResult = parsePositiveInt(
    env.NOTIFY_CHECK_INTERVAL_MS,
    CONFIG_DEFAULTS.notifyCheckIntervalMs,
    CONFIG_CONSTRAINTS.notifyCheckIntervalMs
  );
  if (notifyIntervalResult.error) {
    errors.push({
      field: 'NOTIFY_CHECK_INTERVAL_MS',
      message: notifyIntervalResult.error,
      value: env.NOTIFY_CHECK_INTERVAL_MS,
    });
  }

  const notifyMinutesResult = parsePositiveInt(
    env.DEFAULT_NOTIFY_MINUTES_BEFORE,
    CONFIG_DEFAULTS.defaultNotifyMinutesBefore,
    CONFIG_CONSTRAINTS.defaultNotifyMinutesBefore
  );
  if (notifyMinutesResult.error) {
    errors.push({
      field: 'DEFAULT_NOTIFY_MINUTES_BEFORE',
      message: notifyMinutesResult.error,
      value: env.DEFAULT_NOTIFY_MINUTES_BEFORE,
    });
  }

  // AI機能の依存関係チェック
  const enableAiAgent = parseBoolean(env.ENABLE_AI_AGENT, CONFIG_DEFAULTS.enableAiAgent);
  if (enableAiAgent && !env.OPENAI_API_KEY) {
    // これは警告レベル（エラーにはしない）
    // AIは無効化されるが、ボット自体は動作可能
  }

  // エラーがあれば失敗
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // ジョブストアディレクトリとDB URLの決定
  const jobStoreDir = env.JOB_STORE_DIR || CONFIG_DEFAULTS.jobStoreDir;
  const databaseUrl = env.DATABASE_URL || `${jobStoreDir}/app.db`;

  // 設定オブジェクトを構築
  const config: AppConfig = {
    discordBotToken: env.DISCORD_BOT_TOKEN!,
    connpassApiKey: env.CONNPASS_API_KEY!,
    storageType,
    jobStoreDir,
    databaseUrl,
    logLevel,
    logDestination,
    enableAiAgent,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    googleGenerativeAiApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    enableEventNotify: parseBoolean(env.ENABLE_EVENT_NOTIFY, CONFIG_DEFAULTS.enableEventNotify),
    notifyCheckIntervalMs: notifyIntervalResult.value,
    defaultNotifyMinutesBefore: notifyMinutesResult.value,
  };

  return { valid: true, errors: [], config };
}

/**
 * 環境変数から設定を読み込み、検証失敗時は例外をスロー
 */
export function loadConfigOrThrow(env: RawEnvConfig = process.env as RawEnvConfig): AppConfig {
  const result = validateConfig(env);

  if (!result.valid || !result.config) {
    const errorMessages = result.errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return result.config;
}
