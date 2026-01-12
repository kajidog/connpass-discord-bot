import type {
  ButtonInteraction,
  TextChannel,
  ThreadChannel,
  Message,
} from 'discord.js';
import { EmbedBuilder, ChannelType } from 'discord.js';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { IUserStore, ConnpassEvent } from '@connpass-discord-bot/core';
import { buildDetailEmbed } from '../embeds/detailEmbed.js';

/**
 * ボタンインタラクションハンドラー
 */
export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  client: ConnpassClient,
  userStore: IUserStore
): Promise<void> {
  const customId = interaction.customId;

  // ev:action:eventId 形式をパース
  if (!customId.startsWith('ev:')) return;

  const [, action, eventIdStr] = customId.split(':');
  const eventId = parseInt(eventIdStr, 10);

  if (isNaN(eventId)) {
    await interaction.reply({
      content: '無効なイベントIDです。',
      ephemeral: true,
    });
    return;
  }

  switch (action) {
    case 'detail':
      await handleDetailButton(interaction, client, eventId);
      break;
    case 'speakers':
      await handleSpeakersButton(interaction, client, eventId);
      break;
    case 'conflict':
      await handleConflictButton(interaction, client, userStore, eventId);
      break;
    default:
      await interaction.reply({
        content: '不明なアクションです。',
        ephemeral: true,
      });
  }
}

/**
 * 詳細ボタンハンドラー
 */
async function handleDetailButton(
  interaction: ButtonInteraction,
  client: ConnpassClient,
  eventId: number
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await client.searchEvents({ eventId: [eventId] });

    if (response.events.length === 0) {
      await interaction.editReply({ content: 'イベントが見つかりませんでした。' });
      return;
    }

    const event = response.events[0] as unknown as ConnpassEvent;
    const embed = buildDetailEmbed(event);

    // スレッドに投稿
    const thread = await getOrCreateThread(interaction);
    if (thread) {
      await thread.send({ embeds: [embed] });
      await interaction.editReply({ content: 'スレッドに詳細を投稿しました。' });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply({ content: `エラー: ${message}` });
  }
}

/**
 * 登壇ボタンハンドラー
 */
async function handleSpeakersButton(
  interaction: ButtonInteraction,
  client: ConnpassClient,
  eventId: number
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const presentations = await client.getEventPresentations(eventId);

    if (presentations.presentations.length === 0) {
      await interaction.editReply({ content: 'このイベントには登壇情報がありません。' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('登壇情報')
      .setColor(0x00a3ff);

    for (const pres of presentations.presentations.slice(0, 10)) {
      const value = [
        `**登壇者**: ${pres.speakerName}`,
        pres.url ? `[資料リンク](${pres.url})` : null,
        pres.slideshareUrl ? `[SlideShare](${pres.slideshareUrl})` : null,
        pres.youtubeUrl ? `[YouTube](${pres.youtubeUrl})` : null,
      ]
        .filter(Boolean)
        .join('\n');

      embed.addFields({ name: pres.title || '無題', value: value || '情報なし' });
    }

    // スレッドに投稿
    const thread = await getOrCreateThread(interaction);
    if (thread) {
      await thread.send({ embeds: [embed] });
      await interaction.editReply({ content: 'スレッドに登壇情報を投稿しました。' });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply({ content: `エラー: ${message}` });
  }
}

/**
 * 重複チェックボタンハンドラー
 */
async function handleConflictButton(
  interaction: ButtonInteraction,
  client: ConnpassClient,
  userStore: IUserStore,
  eventId: number
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // ユーザーのニックネームを取得
    const user = await userStore.find(interaction.user.id);
    if (!user) {
      await interaction.editReply({
        content:
          '重複チェックにはConnpassニックネームの登録が必要です。\n`/connpass user register` で登録してください。',
      });
      return;
    }

    // 対象イベントを取得
    const targetResponse = await client.searchEvents({ eventId: [eventId] });
    if (targetResponse.events.length === 0) {
      await interaction.editReply({ content: 'イベントが見つかりませんでした。' });
      return;
    }

    const targetEvent = targetResponse.events[0];
    const targetStart = new Date(targetEvent.startedAt).getTime();
    const targetEnd = new Date(targetEvent.endedAt).getTime();

    // ユーザーの参加イベントを取得
    const userEvents = await client.searchEvents({
      nickname: user.connpassNickname,
      order: 2, // started_asc
    });

    // 時間が重複するイベントを抽出
    const conflicts = userEvents.events.filter((e) => {
      if (e.id === eventId) return false;
      const start = new Date(e.startedAt).getTime();
      const end = new Date(e.endedAt).getTime();
      // 時間帯が重複しているかチェック
      return start < targetEnd && end > targetStart;
    });

    if (conflicts.length === 0) {
      await interaction.editReply({
        content: `**${targetEvent.title}** と時間が重複するイベントはありません。`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('重複イベント')
      .setDescription(`**${targetEvent.title}** と時間が重複するイベント:`)
      .setColor(0xff6b6b);

    for (const e of conflicts.slice(0, 10)) {
      const when = formatPeriod(e.startedAt, e.endedAt);
      embed.addFields({
        name: e.title,
        value: `${when}\n[詳細](${e.url})`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply({ content: `エラー: ${message}` });
  }
}

/**
 * スレッドを取得または作成
 */
async function getOrCreateThread(
  interaction: ButtonInteraction
): Promise<ThreadChannel | null> {
  const message = interaction.message;

  // 既にスレッド内の場合
  if (interaction.channel?.isThread()) {
    return interaction.channel;
  }

  // メッセージからスレッドを取得または作成
  if (message && 'startThread' in message) {
    const existing = message.thread;
    if (existing) return existing;

    try {
      const channel = interaction.channel as TextChannel;
      if (channel.type === ChannelType.GuildText) {
        const thread = await (message as Message).startThread({
          name: 'イベント詳細',
          autoArchiveDuration: 60,
        });
        return thread;
      }
    } catch {
      // スレッド作成失敗
    }
  }

  return null;
}

/**
 * 期間をフォーマット
 */
function formatPeriod(start?: string, end?: string): string {
  if (!start) return '';
  const s = formatJstDateTime(start);
  const e = end ? formatJstDateTime(end) : '';
  return e && s !== e ? `${s} 〜 ${e}` : s;
}

/**
 * JST日時をフォーマット
 */
function formatJstDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(d);
}
