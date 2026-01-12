import { REST, Routes } from 'discord.js';
import { commands } from './commands/definitions.js';

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token || !applicationId) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID are required');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  try {
    console.log('Started refreshing application (/) commands.');

    // applicationIdはnullチェック済みなので安全
    await rest.put(Routes.applicationCommands(applicationId as string), {
      body: commands,
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
    process.exit(1);
  }
}

main();
