import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Connpassエージェント
import { connpassAgent } from './agents/connpass-agent.js';

// 天気エージェント（サンプル用に残す）
import { weatherWorkflow } from './workflows/weather-workflow.js';
import { weatherAgent } from './agents/weather-agent.js';
import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
} from './scorers/weather-scorer.js';

/**
 * Mastraインスタンス
 */
export const mastra = new Mastra({
  agents: {
    // メインのConnpassアシスタント
    connpassAgent,
    // サンプル用
    weatherAgent,
  },
  workflows: {
    weatherWorkflow,
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  storage: new LibSQLStore({
    // 環境変数で永続化DBを指定可能
    url: process.env.MASTRA_STORAGE_URL || ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: process.env.LOG_LEVEL || 'info',
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: { enabled: true },
  },
  bundler: {
    externals: ['cron-parser'],
  },
});

// エージェントとメモリをエクスポート（Discord Bot側で使用）
export { connpassAgent } from './agents/connpass-agent.js';
export { memory } from './agents/connpass-agent.js';
