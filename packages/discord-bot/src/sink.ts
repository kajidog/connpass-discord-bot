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

    // Send one message per event with requested fields
    for (const e of payload.events) {
      const when = fmtPeriod(e.startedAt, e.endedAt);
      const message = [
        `${e.title}`,
        `${e.url}`,
        `実施日時: ${when}`,
        `参加人数: ${e.participantCount}`,
        `catch: ${e.catchPhrase ?? ''}`,
      ].join('\n');
      // send sequentially to preserve order
      // eslint-disable-next-line no-await-in-loop
      await channel.send({ content: message });
    }
  }
}
