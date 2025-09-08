import { Client, GatewayIntentBits, Events, InteractionType } from 'discord.js';
import { createInProcessRunner, FileJobStore } from '@connpass-discord-bot/job';
import { DiscordSink } from './sink';
import { handleCommand } from './commands';

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
  const { manager, scheduler } = createInProcessRunner({ apiKey: connpassApiKey as string, sink, store });

  client.once(Events.ClientReady, async (c) => {
    // eslint-disable-next-line no-console
    console.log(`Discord bot logged in as ${c.user.tag}`);
    await scheduler.startAll();
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'connpass') return;

    await handleCommand(interaction, manager, scheduler);
  });

  await client.login(token as string);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
