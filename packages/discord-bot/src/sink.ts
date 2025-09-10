import { JobSink, NewEventsPayload } from '@connpass-discord-bot/job';
import type { Client, TextBasedChannel } from 'discord.js';

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function fmtPeriod(start?: string, end?: string): string {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e && s !== e) return `${s} 〜 ${e}`;
  return s || e || '';
}

export class DiscordSink implements JobSink {
  constructor(private readonly client: Client) {}

  async handleNewEvents(payload: NewEventsPayload): Promise<void> {
    const fetched = await this.client.channels.fetch(payload.channelId).catch(() => null);
    if (!fetched || !('isTextBased' in fetched) || !fetched.isTextBased()) return;
    const channel = fetched as TextBasedChannel;
    const canSend = (c: any): c is { send: (options: any) => Promise<any> } => typeof c?.send === 'function';
    if (!canSend(channel)) return;

    // Send one rich embed per event with key fields
    for (const e of payload.events) {
      const when = fmtPeriod(e.startedAt, e.endedAt);
      const place = e.place || '';
      const address = e.address || '';
      const venue = [place, address].filter(Boolean).join(' ');
      const participants = e.limit ? `${e.participantCount}/${e.limit}` : `${e.participantCount}`;
      const description = [e.catchPhrase]
        .filter(Boolean)
        .join('\n');

      const embed = {
        title: e.title,
        url: e.url,
        description: description || undefined,
        color: 0x00a3ff,
        fields: [
          when ? { name: '開催日時', value: when, inline: false } : undefined,
          venue ? { name: '会場', value: venue, inline: false } : undefined,
          { name: '参加', value: participants, inline: true },
          e.hashTag ? { name: 'ハッシュタグ', value: `#${e.hashTag}`, inline: true } : undefined,
          e.groupTitle || e.groupUrl
            ? { name: 'グループ', value: e.groupUrl ? `[${e.groupTitle ?? e.groupUrl}](${e.groupUrl})` : `${e.groupTitle}`, inline: false }
            : undefined,
        ].filter(Boolean),
        timestamp: e.updatedAt,
        footer: { text: '最終更新' },
      } as const;

      // send sequentially to preserve order
      // eslint-disable-next-line no-await-in-loop
      await channel.send({ embeds: [embed] });
    }
  }
}
