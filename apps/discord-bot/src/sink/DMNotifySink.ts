import type { Client } from 'discord.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { INotifySink } from '@connpass-discord-bot/feed-worker';
import type { ConnpassEvent } from '@connpass-discord-bot/core';

/**
 * DM通知シンク
 * イベント開始前にユーザーにDMで通知を送信
 */
export class DMNotifySink implements INotifySink {
  constructor(private readonly client: Client) {}

  async sendEventNotification(
    discordUserId: string,
    events: ConnpassEvent[]
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(discordUserId);
      const dmChannel = await user.createDM();

      for (const event of events) {
        try {
          const embed = this.buildNotifyEmbed(event);
          const buttons = this.buildNotifyButtons(event);

          await dmChannel.send({
            embeds: [embed],
            components: [buttons],
          });

          // レート制限対策
          await this.delay(500);
        } catch (error) {
          console.error(
            `[DMNotifySink] Failed to send event ${event.id} to ${discordUserId}:`,
            error
          );
        }
      }
    } catch (error) {
      // DMが無効化されている場合などのエラー
      console.error(
        `[DMNotifySink] Failed to send DM to ${discordUserId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 通知用Embedを構築
   */
  private buildNotifyEmbed(event: ConnpassEvent): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(event.title)
      .setURL(event.url)
      .setDescription('⏰ もうすぐ始まります！')
      .setColor(0xff6b6b); // 注目を引く赤系の色

    // サムネイル
    if (event.imageUrl) {
      embed.setThumbnail(event.imageUrl);
    }

    return embed;
  }

  /**
   * 通知用ボタンを構築
   */
  private buildNotifyButtons(
    event: ConnpassEvent
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('イベントページを開く')
        .setStyle(ButtonStyle.Link)
        .setURL(event.url)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
