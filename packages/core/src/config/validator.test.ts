import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  loadConfigOrThrow,
  parseBoolean,
  parsePositiveInt,
  CONFIG_DEFAULTS,
} from './validator.js';
import type { RawEnvConfig } from './types.js';

describe('parseBoolean', () => {
  it('true を返す値', () => {
    expect(parseBoolean('true', false)).toBe(true);
    expect(parseBoolean('TRUE', false)).toBe(true);
    expect(parseBoolean('True', false)).toBe(true);
    expect(parseBoolean('1', false)).toBe(true);
    expect(parseBoolean('yes', false)).toBe(true);
    expect(parseBoolean('YES', false)).toBe(true);
  });

  it('false を返す値', () => {
    expect(parseBoolean('false', true)).toBe(false);
    expect(parseBoolean('FALSE', true)).toBe(false);
    expect(parseBoolean('False', true)).toBe(false);
    expect(parseBoolean('0', true)).toBe(false);
    expect(parseBoolean('no', true)).toBe(false);
    expect(parseBoolean('NO', true)).toBe(false);
  });

  it('undefined や空文字はデフォルト値を返す', () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean(undefined, false)).toBe(false);
    expect(parseBoolean('', true)).toBe(true);
    expect(parseBoolean('', false)).toBe(false);
  });

  it('認識できない値はデフォルト値を返す', () => {
    expect(parseBoolean('invalid', true)).toBe(true);
    expect(parseBoolean('invalid', false)).toBe(false);
  });
});

describe('parsePositiveInt', () => {
  it('有効な正の整数をパースする', () => {
    const result = parsePositiveInt('123', 0);
    expect(result.value).toBe(123);
    expect(result.error).toBeUndefined();
  });

  it('undefined や空文字はデフォルト値を返す', () => {
    expect(parsePositiveInt(undefined, 42).value).toBe(42);
    expect(parsePositiveInt('', 42).value).toBe(42);
  });

  it('無効な値はエラーを返す', () => {
    const result = parsePositiveInt('invalid', 42);
    expect(result.value).toBe(42);
    expect(result.error).toContain('Invalid integer');
  });

  it('負の値はエラーを返す', () => {
    const result = parsePositiveInt('-10', 42);
    expect(result.value).toBe(42);
    expect(result.error).toContain('must be positive');
  });

  it('0 はエラーを返す', () => {
    const result = parsePositiveInt('0', 42);
    expect(result.value).toBe(42);
    expect(result.error).toContain('must be positive');
  });

  it('制約の min を下回るとエラー', () => {
    const result = parsePositiveInt('5', 100, { min: 10 });
    expect(result.value).toBe(100);
    expect(result.error).toContain('>= 10');
  });

  it('制約の max を超えるとエラー', () => {
    const result = parsePositiveInt('500', 100, { max: 200 });
    expect(result.value).toBe(100);
    expect(result.error).toContain('<= 200');
  });

  it('制約内の値は正常にパースされる', () => {
    const result = parsePositiveInt('150', 100, { min: 10, max: 200 });
    expect(result.value).toBe(150);
    expect(result.error).toBeUndefined();
  });
});

describe('validateConfig', () => {
  describe('成功ケース', () => {
    it('必須項目のみで設定が有効', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toBeDefined();
      expect(result.config!.discordBotToken).toBe('test-token');
      expect(result.config!.connpassApiKey).toBe('test-api-key');
    });

    it('すべてのオプション項目を含む設定が有効', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        STORAGE_TYPE: 'sqlite',
        JOB_STORE_DIR: '/custom/data',
        DATABASE_URL: '/custom/app.db',
        LOG_LEVEL: 'debug',
        LOG_DESTINATION: 'both',
        ENABLE_AI_AGENT: 'true',
        OPENAI_API_KEY: 'openai-key',
        ENABLE_EVENT_NOTIFY: 'true',
        NOTIFY_CHECK_INTERVAL_MS: '30000',
        DEFAULT_NOTIFY_MINUTES_BEFORE: '15',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(true);
      expect(result.config!.storageType).toBe('sqlite');
      expect(result.config!.jobStoreDir).toBe('/custom/data');
      expect(result.config!.databaseUrl).toBe('/custom/app.db');
      expect(result.config!.logLevel).toBe('debug');
      expect(result.config!.logDestination).toBe('both');
      expect(result.config!.enableAiAgent).toBe(true);
      expect(result.config!.openaiApiKey).toBe('openai-key');
      expect(result.config!.notifyCheckIntervalMs).toBe(30000);
      expect(result.config!.defaultNotifyMinutesBefore).toBe(15);
    });

    it('デフォルト値が正しく適用される', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
      };

      const result = validateConfig(env);

      expect(result.config!.storageType).toBe(CONFIG_DEFAULTS.storageType);
      expect(result.config!.jobStoreDir).toBe(CONFIG_DEFAULTS.jobStoreDir);
      expect(result.config!.logLevel).toBe(CONFIG_DEFAULTS.logLevel);
      expect(result.config!.logDestination).toBe(CONFIG_DEFAULTS.logDestination);
      expect(result.config!.enableAiAgent).toBe(CONFIG_DEFAULTS.enableAiAgent);
      expect(result.config!.notifyCheckIntervalMs).toBe(CONFIG_DEFAULTS.notifyCheckIntervalMs);
    });
  });

  describe('失敗ケース - 必須項目', () => {
    it('DISCORD_BOT_TOKEN がないとエラー', () => {
      const env: RawEnvConfig = {
        CONNPASS_API_KEY: 'test-api-key',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'DISCORD_BOT_TOKEN')).toBe(true);
    });

    it('CONNPASS_API_KEY がないとエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'CONNPASS_API_KEY')).toBe(true);
    });

    it('両方の必須項目がないと両方エラー', () => {
      const env: RawEnvConfig = {};

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some((e) => e.field === 'DISCORD_BOT_TOKEN')).toBe(true);
      expect(result.errors.some((e) => e.field === 'CONNPASS_API_KEY')).toBe(true);
    });

    it('空文字の必須項目はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: '',
        CONNPASS_API_KEY: '   ',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'DISCORD_BOT_TOKEN')).toBe(true);
      expect(result.errors.some((e) => e.field === 'CONNPASS_API_KEY')).toBe(true);
    });
  });

  describe('失敗ケース - 列挙型フィールド', () => {
    it('無効な STORAGE_TYPE はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        STORAGE_TYPE: 'mongodb',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'STORAGE_TYPE')).toBe(true);
    });

    it('無効な LOG_LEVEL はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        LOG_LEVEL: 'verbose',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'LOG_LEVEL')).toBe(true);
    });

    it('無効な LOG_DESTINATION はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        LOG_DESTINATION: 'file',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'LOG_DESTINATION')).toBe(true);
    });
  });

  describe('失敗ケース - 整合性チェック', () => {
    it('ファイルストレージで database ログはエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        STORAGE_TYPE: 'file',
        LOG_DESTINATION: 'database',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'LOG_DESTINATION')).toBe(true);
      expect(result.errors.some((e) => e.message.includes('requires STORAGE_TYPE=sqlite'))).toBe(
        true
      );
    });

    it('ファイルストレージで both ログもエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        STORAGE_TYPE: 'file',
        LOG_DESTINATION: 'both',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'LOG_DESTINATION')).toBe(true);
    });
  });

  describe('失敗ケース - 数値パラメータ', () => {
    it('無効な NOTIFY_CHECK_INTERVAL_MS はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        NOTIFY_CHECK_INTERVAL_MS: 'invalid',
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'NOTIFY_CHECK_INTERVAL_MS')).toBe(true);
    });

    it('範囲外の NOTIFY_CHECK_INTERVAL_MS はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        NOTIFY_CHECK_INTERVAL_MS: '1000', // min は 10000
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'NOTIFY_CHECK_INTERVAL_MS')).toBe(true);
    });

    it('範囲外の DEFAULT_NOTIFY_MINUTES_BEFORE はエラー', () => {
      const env: RawEnvConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        CONNPASS_API_KEY: 'test-api-key',
        DEFAULT_NOTIFY_MINUTES_BEFORE: '5000', // max は 1440
      };

      const result = validateConfig(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'DEFAULT_NOTIFY_MINUTES_BEFORE')).toBe(true);
    });
  });
});

describe('loadConfigOrThrow', () => {
  it('有効な設定では config を返す', () => {
    const env: RawEnvConfig = {
      DISCORD_BOT_TOKEN: 'test-token',
      CONNPASS_API_KEY: 'test-api-key',
    };

    const config = loadConfigOrThrow(env);

    expect(config.discordBotToken).toBe('test-token');
    expect(config.connpassApiKey).toBe('test-api-key');
  });

  it('無効な設定では例外をスロー', () => {
    const env: RawEnvConfig = {};

    expect(() => loadConfigOrThrow(env)).toThrow('Configuration validation failed');
  });

  it('エラーメッセージに詳細が含まれる', () => {
    const env: RawEnvConfig = {
      STORAGE_TYPE: 'invalid',
    };

    expect(() => loadConfigOrThrow(env)).toThrow('DISCORD_BOT_TOKEN');
    expect(() => loadConfigOrThrow(env)).toThrow('CONNPASS_API_KEY');
    expect(() => loadConfigOrThrow(env)).toThrow('STORAGE_TYPE');
  });
});
