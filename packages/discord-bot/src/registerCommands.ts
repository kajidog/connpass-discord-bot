import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import type { APIApplicationCommand } from 'discord-api-types/v10';
import { commandData } from './commands';

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional: when set, register guild-scoped

if (!token || !appId) {
  // eslint-disable-next-line no-console
  console.error('DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID are required');
  process.exit(1);
}

async function main() {
  const rest = new REST({ version: '10' }).setToken(token as string);
  const commands: APIApplicationCommand[] = [commandData as unknown as APIApplicationCommand];

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId as string, guildId as string), { body: commands });
    // eslint-disable-next-line no-console
    console.log(`Registered guild commands for guild ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(appId as string), { body: commands });
    // eslint-disable-next-line no-console
    console.log('Registered global commands');
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
