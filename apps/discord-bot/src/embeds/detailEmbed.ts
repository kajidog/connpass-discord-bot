import { EmbedBuilder } from 'discord.js';
import type { ConnpassEvent } from '@connpass-discord-bot/core';
import { htmlToDiscord } from '../utils/htmlToDiscord.js';

/**
 * イベント詳細埋め込みを構築
 */
export function buildDetailEmbed(event: ConnpassEvent): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${event.title} - 詳細`)
    .setURL(event.url)
    .setColor(0x00a3ff);

  // 説明文（HTMLをマークダウンに変換）
  if (event.description) {
    const description = htmlToDiscord(event.description);
    // Discord埋め込みの説明は4096文字まで
    const truncated =
      description.length > 4000 ? description.slice(0, 4000) + '...' : description;
    embed.setDescription(truncated);
  }

  // 開催日時
  if (event.startedAt) {
    const when = formatPeriod(event.startedAt, event.endedAt);
    embed.addFields({ name: '開催日時', value: when, inline: false });
  }

  // 会場
  const venue = [event.place, event.address].filter(Boolean).join('\n');
  if (venue) {
    embed.addFields({ name: '会場', value: venue, inline: false });
  }

  // 主催者
  if (event.ownerDisplayName || event.ownerNickname) {
    embed.addFields({
      name: '主催者',
      value: event.ownerDisplayName || event.ownerNickname,
      inline: true,
    });
  }

  // 参加者
  const participants = event.limit
    ? `${event.participantCount}/${event.limit}`
    : `${event.participantCount}`;
  embed.addFields({ name: '参加者', value: participants, inline: true });

  return embed;
}

/**
 * 期間をフォーマット
 */
function formatPeriod(start?: string, end?: string): string {
  if (!start) return '';
  const s = formatJstDateTime(start);
  const e = end ? formatJstDateTime(end) : '';
  return e && s !== e ? `${s}\n〜 ${e}` : s;
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
