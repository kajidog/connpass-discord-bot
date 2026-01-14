import { eq } from 'drizzle-orm';
import type { ChannelModelConfig, IChannelModelStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { channelModelConfigs } from '../../db/schema/index.js';

export class DrizzleChannelModelStore implements IChannelModelStore {
  constructor(private db: DrizzleDB) {}

  async get(channelId: string): Promise<ChannelModelConfig | null> {
    const row = await this.db.query.channelModelConfigs.findFirst({
      where: eq(channelModelConfigs.channelId, channelId),
    });
    if (!row) return null;
    return this.rowToConfig(row);
  }

  async save(config: ChannelModelConfig): Promise<void> {
    await this.db
      .insert(channelModelConfigs)
      .values({
        channelId: config.channelId,
        agentProvider: config.agent?.provider ?? null,
        agentModel: config.agent?.model ?? null,
        summarizerProvider: config.summarizer?.provider ?? null,
        summarizerModel: config.summarizer?.model ?? null,
      })
      .onConflictDoUpdate({
        target: channelModelConfigs.channelId,
        set: {
          agentProvider: config.agent?.provider ?? null,
          agentModel: config.agent?.model ?? null,
          summarizerProvider: config.summarizer?.provider ?? null,
          summarizerModel: config.summarizer?.model ?? null,
        },
      });
  }

  async delete(channelId: string): Promise<void> {
    await this.db
      .delete(channelModelConfigs)
      .where(eq(channelModelConfigs.channelId, channelId));
  }

  private rowToConfig(
    row: typeof channelModelConfigs.$inferSelect
  ): ChannelModelConfig {
    const config: ChannelModelConfig = {
      channelId: row.channelId,
    };
    if (row.agentProvider && row.agentModel) {
      config.agent = {
        provider: row.agentProvider as 'openai' | 'anthropic' | 'google',
        model: row.agentModel,
      };
    }
    if (row.summarizerProvider && row.summarizerModel) {
      config.summarizer = {
        provider: row.summarizerProvider as 'openai' | 'anthropic' | 'google',
        model: row.summarizerModel,
      };
    }
    return config;
  }
}
