import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { IUserStore } from '@connpass-discord-bot/core';
import { buildEventEmbed, buildEventButtons } from '../../embeds/eventEmbed.js';

/**
 * /connpass today ハンドラー
 */
export async function handleToday(
  interaction: ChatInputCommandInteraction,
  userStore: IUserStore,
  client: ConnpassClient
): Promise<void> {
  const discordUserId = interaction.user.id;
  const user = await userStore.find(discordUserId);

  if (!user) {
    await interaction.reply({
      content:
        'Connpassニックネームが登録されていません。\n`/connpass user register` で登録してください。',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // 今日の日付
    const today = new Date();
    const ymd = formatYmd(today);

    // ユーザーが参加しているイベントを取得
    const response = await client.searchEvents({
      nickname: user.connpassNickname,
      ymdFrom: ymd,
      ymdTo: ymd,
      order: 2, // started_asc
    });

    const events = response.events;

    if (events.length === 0) {
      await interaction.editReply({
        content: `今日 (${ymd}) 参加予定のイベントはありません。`,
      });
      return;
    }

    // イベント一覧を埋め込みで表示
    const embeds: EmbedBuilder[] = [];
    const components = [];

    for (const event of events.slice(0, 5)) {
      embeds.push(buildEventEmbed(event as any));
      components.push(buildEventButtons(event as any));
    }

    const totalMessage =
      events.length > 5
        ? `今日 (${ymd}) 参加予定のイベント（${events.length}件中5件を表示）:`
        : `今日 (${ymd}) 参加予定のイベント:`;

    await interaction.editReply({
      content: totalMessage,
      embeds,
      components,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply({
      content: `イベント取得エラー: ${message}`,
    });
  }
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
