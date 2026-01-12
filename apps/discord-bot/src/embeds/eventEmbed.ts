import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { ConnpassEvent } from '@connpass-discord-bot/core';

/**
 * イベント埋め込みを構築
 */
export function buildEventEmbed(event: ConnpassEvent): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(event.title)
    .setURL(event.url)
    .setColor(0x00a3ff)
    .setTimestamp(new Date(event.updatedAt))
    .setFooter({ text: 'Last updated' });

  if (event.catchPhrase) {
    embed.setDescription(event.catchPhrase);
  }

  // 開催日時
  const when = formatPeriod(event.startedAt, event.endedAt);
  if (when) {
    embed.addFields({ name: '開催日時', value: when, inline: false });
  }

  // 会場
  const venue = [event.place, event.address].filter(Boolean).join(' ');
  if (venue) {
    embed.addFields({ name: '会場', value: venue, inline: false });
  }

  // 参加者
  const participants = event.limit
    ? `${event.participantCount}/${event.limit}`
    : `${event.participantCount}`;
  embed.addFields({ name: '参加', value: participants, inline: true });

  // キャンセル待ち
  if (event.waitingCount > 0) {
    embed.addFields({ name: 'キャンセル待ち', value: String(event.waitingCount), inline: true });
  }

  // ハッシュタグ
  if (event.hashTag) {
    embed.addFields({ name: 'ハッシュタグ', value: `#${event.hashTag}`, inline: true });
  }

  // グループ
  if (event.groupTitle || event.groupUrl) {
    const groupValue = event.groupUrl
      ? `[${event.groupTitle || 'グループページ'}](${event.groupUrl})`
      : event.groupTitle!;
    embed.addFields({ name: 'グループ', value: groupValue, inline: false });
  }

  // サムネイル
  if (event.imageUrl) {
    embed.setThumbnail(event.imageUrl);
  }

  return embed;
}

/**
 * イベントボタンを構築
 */
export function buildEventButtons(
  event: ConnpassEvent
): ActionRowBuilder<ButtonBuilder> {
  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`ev:detail:${event.id}`)
      .setLabel('詳細')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ev:speakers:${event.id}`)
      .setLabel('登壇')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ev:conflict:${event.id}`)
      .setLabel('重複チェック')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel('Web').setStyle(ButtonStyle.Link).setURL(event.url),
  ];

  // 地図ボタン
  const mapUrl = buildMapUrl(event);
  if (mapUrl) {
    buttons.push(
      new ButtonBuilder().setLabel('地図').setStyle(ButtonStyle.Link).setURL(mapUrl)
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/**
 * Google MapsのURLを構築
 */
function buildMapUrl(event: ConnpassEvent): string | null {
  if (event.lat != null && event.lon != null) {
    return `https://www.google.com/maps?q=${event.lat},${event.lon}`;
  }
  const query = [event.place, event.address].filter(Boolean).join(' ');
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
