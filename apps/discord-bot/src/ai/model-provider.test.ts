import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateModel,
  hasApiKey,
  getModelConfigForChannel,
  clearConfigCache,
} from './model-provider.js';
import type { AIModelsConfig, ModelConfig } from '@connpass-discord-bot/core';

// AI SDK のモック（実際のAPIキーなしでテスト可能にする）
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({})),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({})),
}));
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => ({})),
}));

const testConfig: AIModelsConfig = {
  agent: { provider: 'openai', model: 'gpt-4o-mini' },
  summarizer: { provider: 'openai', model: 'gpt-4o-mini' },
  allowedModels: {
    openai: ['gpt-4o', 'gpt-4o-mini'],
    anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
};

describe('validateModel', () => {
  it('許可されたモデルの場合は true を返す', () => {
    expect(validateModel(testConfig, 'openai', 'gpt-4o')).toBe(true);
    expect(validateModel(testConfig, 'openai', 'gpt-4o-mini')).toBe(true);
    expect(validateModel(testConfig, 'anthropic', 'claude-sonnet-4-5')).toBe(true);
    expect(validateModel(testConfig, 'google', 'gemini-2.0-flash')).toBe(true);
  });

  it('許可されていないモデルの場合は false を返す', () => {
    expect(validateModel(testConfig, 'openai', 'gpt-3.5-turbo')).toBe(false);
    expect(validateModel(testConfig, 'anthropic', 'claude-2')).toBe(false);
    expect(validateModel(testConfig, 'google', 'gemini-pro')).toBe(false);
  });

  it('存在しないプロバイダーの場合は false を返す', () => {
    expect(validateModel(testConfig, 'unknown' as any, 'model')).toBe(false);
  });
});

describe('hasApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('OpenAI APIキーが設定されている場合は true を返す', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(hasApiKey('openai')).toBe(true);
  });

  it('OpenAI APIキーが未設定の場合は false を返す', () => {
    delete process.env.OPENAI_API_KEY;
    expect(hasApiKey('openai')).toBe(false);
  });

  it('Anthropic APIキーのチェック', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(hasApiKey('anthropic')).toBe(false);

    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(hasApiKey('anthropic')).toBe(true);
  });

  it('Google APIキーのチェック', () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(hasApiKey('google')).toBe(false);

    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'ai-test';
    expect(hasApiKey('google')).toBe(true);
  });

  it('不明なプロバイダーは false を返す', () => {
    expect(hasApiKey('unknown' as any)).toBe(false);
  });
});

describe('getModelConfigForChannel', () => {
  it('チャンネル設定がある場合はそれを優先する', () => {
    const channelConfig = {
      agent: { provider: 'anthropic' as const, model: 'claude-sonnet-4-5' },
      summarizer: { provider: 'google' as const, model: 'gemini-2.0-flash' },
    };

    const agentConfig = getModelConfigForChannel(testConfig, 'agent', channelConfig);
    expect(agentConfig.provider).toBe('anthropic');
    expect(agentConfig.model).toBe('claude-sonnet-4-5');

    const summarizerConfig = getModelConfigForChannel(testConfig, 'summarizer', channelConfig);
    expect(summarizerConfig.provider).toBe('google');
    expect(summarizerConfig.model).toBe('gemini-2.0-flash');
  });

  it('チャンネル設定がない場合はグローバル設定を使う', () => {
    const result = getModelConfigForChannel(testConfig, 'agent', null);

    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('チャンネル設定が undefined の場合はグローバル設定を使う', () => {
    const result = getModelConfigForChannel(testConfig, 'agent', undefined);

    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('チャンネル設定の一部のみ設定されている場合はグローバルにフォールバック', () => {
    const channelConfig = {
      agent: { provider: 'anthropic' as const, model: 'claude-sonnet-4-5' },
      // summarizer は未設定
    };

    const agentConfig = getModelConfigForChannel(testConfig, 'agent', channelConfig);
    expect(agentConfig.provider).toBe('anthropic');

    const summarizerConfig = getModelConfigForChannel(testConfig, 'summarizer', channelConfig);
    expect(summarizerConfig.provider).toBe('openai'); // グローバル
    expect(summarizerConfig.model).toBe('gpt-4o-mini'); // グローバル
  });
});
