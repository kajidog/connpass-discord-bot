import type { Client, TextChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import type { ISink } from '@connpass-discord-bot/feed-worker';
import type { NewEventsPayload } from '@connpass-discord-bot/core';
import { buildEventEmbed, buildEventButtons } from '../embeds/eventEmbed.js';

/**
 * Discord通知シンク
 */
export class DiscordSink implements ISink {
  constructor(private readonly client: Client) {}

  async handleNewEvents(payload: NewEventsPayload): Promise<void> {
    const channel = await this.client.channels.fetch(payload.channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error(`[DiscordSink] Channel ${payload.channelId} is not a text channel`);
      return;
    }

    const textChannel = channel as TextChannel;

    // イベントを1つずつ投稿（5件まで）
    for (const event of payload.events.slice(0, 5)) {
      try {
        const embed = buildEventEmbed(event);
        const buttons = buildEventButtons(event);

        await textChannel.send({
          embeds: [embed],
          components: [buttons],
        });

        // レート制限を考慮して少し待つ
        await this.delay(500);
      } catch (error) {
        console.error(`[DiscordSink] Failed to send event ${event.id}:`, error);
      }
    }

    // 5件以上の場合は件数を通知
    if (payload.events.length > 5) {
      await textChannel.send({
        content: `他にも ${payload.events.length - 5} 件の新着イベントがあります。`,
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
