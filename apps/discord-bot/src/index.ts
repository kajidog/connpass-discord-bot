import { Client, GatewayIntentBits, Events } from 'discord.js';
import { ConnpassClient } from '@kajidog/connpass-api-client';
import {
  FileFeedStore,
  FileUserStore,
  FeedExecutor,
  Scheduler,
} from '@connpass-discord-bot/feed-worker';
import { DiscordSink } from './sink/DiscordSink.js';
import { handleAutocomplete } from './interactions/autocomplete.js';
import { handleButtonInteraction } from './interactions/buttons.js';
import {
  handleFeedSet,
  handleFeedStatus,
  handleFeedRemove,
  handleFeedRun,
} from './commands/handlers/feed.js';
import {
  handleUserRegister,
  handleUserShow,
  handleUserUnregister,
} from './commands/handlers/user.js';
import { handleToday } from './commands/handlers/today.js';
import { handleHelp } from './commands/handlers/help.js';

// 環境変数チェック
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CONNPASS_API_KEY = process.env.CONNPASS_API_KEY;
const JOB_STORE_DIR = process.env.JOB_STORE_DIR || './data';

if (!DISCORD_BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

if (!CONNPASS_API_KEY) {
  console.error('CONNPASS_API_KEY is required');
  process.exit(1);
}

// クライアント初期化
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const connpassClient = new ConnpassClient({
  apiKey: CONNPASS_API_KEY,
});

// ストア初期化
const feedStore = new FileFeedStore(JOB_STORE_DIR);
const userStore = new FileUserStore(JOB_STORE_DIR);

// シンク・エグゼキュータ・スケジューラー初期化
const sink = new DiscordSink(discordClient);
const executor = new FeedExecutor(connpassClient, feedStore, sink);
const scheduler = new Scheduler(feedStore, executor);

// Discord準備完了
discordClient.once(Events.ClientReady, async (c) => {
  console.log(`[Discord] Ready! Logged in as ${c.user.tag}`);

  // スケジューラー開始
  await scheduler.start();
});

// インタラクションハンドラー
discordClient.on(Events.InteractionCreate, async (interaction) => {
  try {
    // オートコンプリート
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }

    // ボタン
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction, connpassClient, userStore);
      return;
    }

    // スラッシュコマンド
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== 'connpass') return;

      const group = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      // /connpass feed *
      if (group === 'feed') {
        switch (subcommand) {
          case 'set':
            await handleFeedSet(interaction, feedStore, scheduler);
            break;
          case 'status':
            await handleFeedStatus(interaction, feedStore);
            break;
          case 'remove':
            await handleFeedRemove(interaction, feedStore, scheduler);
            break;
          case 'run':
            await handleFeedRun(interaction, feedStore, executor);
            break;
        }
        return;
      }

      // /connpass user *
      if (group === 'user') {
        switch (subcommand) {
          case 'register':
            await handleUserRegister(interaction, userStore);
            break;
          case 'show':
            await handleUserShow(interaction, userStore);
            break;
          case 'unregister':
            await handleUserUnregister(interaction, userStore);
            break;
        }
        return;
      }

      // /connpass today
      if (subcommand === 'today') {
        await handleToday(interaction, userStore, connpassClient);
        return;
      }

      // /connpass help
      if (subcommand === 'help') {
        await handleHelp(interaction);
        return;
      }
    }
  } catch (error) {
    console.error('[Discord] Interaction error:', error);

    // エラーレスポンス
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'エラーが発生しました。',
        ephemeral: true,
      });
    }
  }
});

// グレースフルシャットダウン
async function shutdown() {
  console.log('[Bot] Shutting down...');
  await scheduler.stop();
  discordClient.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ボット起動
discordClient.login(DISCORD_BOT_TOKEN);
