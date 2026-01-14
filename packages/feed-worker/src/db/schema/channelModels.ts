import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const channelModelConfigs = sqliteTable('channel_model_configs', {
  channelId: text('channel_id').primaryKey(),
  agentProvider: text('agent_provider'),
  agentModel: text('agent_model'),
  summarizerProvider: text('summarizer_provider'),
  summarizerModel: text('summarizer_model'),
});
