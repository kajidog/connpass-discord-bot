import { Client, GatewayIntentBits, Events, InteractionType } from 'discord.js';
import { ConnpassClient, type EventsResponse, type PresentationsResponse } from '@connpass-discord-bot/api-client';
import { createInProcessRunner, FileJobStore, FileUserStore, InMemoryUserStore, UserManager } from '@connpass-discord-bot/job';
import { DiscordSink } from './sink';
import { handleCommand } from './commands';
import { prefectures } from './prefectures';

const token = process.env.DISCORD_BOT_TOKEN;
const connpassApiKey = process.env.CONNPASS_API_KEY;

if (!token) {
  // eslint-disable-next-line no-console
  console.error('DISCORD_BOT_TOKEN is required');
  process.exit(1);
}
if (!connpassApiKey) {
  // eslint-disable-next-line no-console
  console.error('CONNPASS_API_KEY is required');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const jobStoreDir = process.env.JOB_STORE_DIR; // optional: use file persistence when provided

async function main() {
  const sink = new DiscordSink(client);
  const store = jobStoreDir ? new FileJobStore(jobStoreDir) : undefined;
  const userStore = jobStoreDir ? new FileUserStore(jobStoreDir) : new InMemoryUserStore();
  const { manager, scheduler } = createInProcessRunner({ apiKey: connpassApiKey as string, sink, store });
  const userManager = new UserManager(userStore);
  const api = new ConnpassClient({ apiKey: connpassApiKey as string });

  client.once(Events.ClientReady, async (c) => {
    // eslint-disable-next-line no-console
    console.log(`Discord bot logged in as ${c.user.tag}`);
    await scheduler.startAll();
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    // Slash command: /connpass
    if (interaction.type === InteractionType.ApplicationCommand && interaction.isChatInputCommand()) {
      if (interaction.commandName !== 'connpass') return;
      await handleCommand(interaction, manager, scheduler, userManager, api);
      return;
    }

    // Autocomplete for location
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      if (interaction.commandName !== 'connpass') return;
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'location') {
        const query = focused.value.toLowerCase();
        const filtered = prefectures
          .filter(
            (p) =>
              p.value.toLowerCase().includes(query) ||
              p.name.toLowerCase().includes(query)
          )
          .slice(0, 25);
        await interaction.respond(filtered);
      }
      return;
    }

    // Buttons on event messages
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (!id.startsWith('ev:')) return;
      await interaction.deferReply({ ephemeral: true });
      try {
        const [, action, raw] = id.split(':');
        const eventId = Number(raw);
        if (!Number.isFinite(eventId)) throw new Error('invalid event id');

        // Find or create a thread from the parent message
        const parentMessage: any = interaction.message as any;
        let thread = parentMessage.thread ?? null;
        if (!thread) {
          const name = `イベント詳細-${eventId}`;
          thread = await parentMessage.startThread({ name, autoArchiveDuration: 1440 }).catch(() => null);
        }

        if (!thread) throw new Error('スレッドを作成できませんでした');

        if (action === 'detail') {
          const resp: EventsResponse = await api.searchEvents({ eventId: [eventId] });
          const e = resp.events[0];
          if (!e) throw new Error('イベントが見つかりません');

          const when = [e.startedAt, e.endedAt].filter(Boolean).join(' 〜 ');
          const venue = [e.place ?? '', e.address ?? ''].filter(Boolean).join(' ');
          const participants = e.limit ? `${e.participantCount}/${e.limit}` : `${e.participantCount}`;
          const lines: string[] = [];
          lines.push(`【${e.title}】`);
          lines.push(e.url);
          if (when) lines.push(`開催: ${when}`);
          if (venue) lines.push(`会場: ${venue}`);
          lines.push(`参加: ${participants}`);
          if (e.hashTag) lines.push(`ハッシュタグ: #${e.hashTag}`);
          if (e.groupTitle || e.groupUrl) lines.push(`グループ: ${e.groupUrl ? `[${e.groupTitle ?? e.groupUrl}](${e.groupUrl})` : e.groupTitle}`);
          if (e.ownerDisplayName || e.ownerNickname) lines.push(`主催: ${e.ownerDisplayName ?? e.ownerNickname}`);
          if (e.description) {
            const desc = e.description.length > 1500 ? `${e.description.slice(0, 1500)}...` : e.description;
            lines.push('', desc);
          }
          await thread.send(lines.join('\n'));
          await interaction.editReply('詳細をスレッドに投稿しました');
          return;
        }

        if (action === 'pres') {
          const pres: PresentationsResponse = await api.getEventPresentations(eventId);
          if (!pres.presentationsReturned) {
            await thread.send('登壇情報は見つかりませんでした');
          } else {
            const list = pres.presentations
              .sort((a, b) => a.order - b.order)
              .map((p) => {
                const links = [p.url, p.slideshareUrl, p.youtubeUrl, p.twitterUrl].filter(Boolean) as string[];
                const linkText = links.length ? ` - ${links[0]}` : '';
                return `- ${p.title} / ${p.speakerName}${linkText}`;
              })
              .join('\n');
            await thread.send(`登壇情報:\n${list}`);
          }
          await interaction.editReply('登壇情報をスレッドに投稿しました');
          return;
        }

        await interaction.editReply('未知の操作です');
      } catch (e: any) {
        await interaction.editReply(`エラー: ${e?.message ?? e}`);
      }
    }
  });

  // using shared api-client; no local HTTP helpers needed

  await client.login(token as string);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
