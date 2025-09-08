import { JobSink, NewEventsPayload } from '@connpass-discord-bot/job';
import type { Client, TextBasedChannel } from 'discord.js';

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export class DiscordSink implements JobSink {
  constructor(private readonly client: Client) {}

  async handleNewEvents(payload: NewEventsPayload): Promise<void> {
    const fetched = await this.client.channels.fetch(payload.channelId).catch(() => null);
    if (!fetched || !('isTextBased' in fetched) || !fetched.isTextBased()) return;
    const channel = fetched as TextBasedChannel;
    const canSend = (c: any): c is { send: (options: any) => Promise<any> } => typeof c?.send === 'function';
    if (!canSend(channel)) return;

    const lines = payload.events.map((e) => {
      const when = fmtDate(e.startedAt);
      const where = [e.place, e.address].filter(Boolean).join(' ');
      return `• ${e.title}\n  ${when}${where ? ` | ${where}` : ''}\n  ${e.url}`;
    });

    const message = `Connpass: ${payload.events.length} new event(s) found\n\n${lines.join('\n\n')}`;
    await channel.send({ content: message });
  }
}
