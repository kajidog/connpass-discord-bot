import { Client, GatewayIntentBits, Events, Message, ChannelType, Partials } from 'discord.js';
import { ConnpassClient } from '@kajidog/connpass-api-client';
import {
  FileFeedStore,
  FileUserStore,
  FileSummaryCacheStore,
  FileChannelModelStore,
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
import { handleModelCommand } from './commands/handlers/model.js';
import { handleToday } from './commands/handlers/today.js';
import { handleHelp } from './commands/handlers/help.js';
import { handleAgentMentionWithProgress, type AgentContext } from './agent/index.js';

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

// AI機能フラグ
const ENABLE_AI_AGENT = process.env.ENABLE_AI_AGENT !== 'false';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (ENABLE_AI_AGENT && !OPENAI_API_KEY) {
  console.warn('[Bot] OPENAI_API_KEY is not set, AI agent will be disabled');
}

// クライアント初期化
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // AIエージェント用：メッセージ内容を読むためのIntent
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const connpassClient = new ConnpassClient({
  apiKey: CONNPASS_API_KEY,
});

// ストア初期化
const feedStore = new FileFeedStore(JOB_STORE_DIR);
const userStore = new FileUserStore(JOB_STORE_DIR);
const summaryCache = new FileSummaryCacheStore(JOB_STORE_DIR);
const channelModelStore = new FileChannelModelStore(JOB_STORE_DIR);

// シンク・エグゼキュータ・スケジューラー初期化
const sink = new DiscordSink(discordClient);
const executor = new FeedExecutor(connpassClient, feedStore, sink);
const scheduler = new Scheduler(feedStore, executor);

// AIエージェントコンテキスト
const agentContext: AgentContext = {
  connpassClient,
  feedStore,
  userStore,
  summaryCache,
  channelModelStore,
};

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
      await handleButtonInteraction(interaction, connpassClient, userStore, summaryCache, channelModelStore);
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

      // /connpass model *
      if (group === 'model') {
        await handleModelCommand(interaction, channelModelStore);
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

// AIエージェントメンションハンドラー
if (ENABLE_AI_AGENT && OPENAI_API_KEY) {
  discordClient.on(Events.MessageCreate, async (message: Message) => {
    // Botからのメッセージは無視
    if (message.author.bot) return;

    // メンションされていない場合は無視（DM以外）
    const isDM = message.channel.type === ChannelType.DM;
    if (!isDM) {
      if (!discordClient.user) return;
      if (!message.mentions.has(discordClient.user)) return;
    }

    try {
      await handleAgentMentionWithProgress(message, agentContext);
    } catch (error) {
      console.error('[Agent] Error handling mention:', error);
      try {
        await message.reply('申し訳ありません。エラーが発生しました。');
      } catch {
        // 返信に失敗した場合は無視
      }
    }
  });

  console.log('[Bot] AI Agent enabled');
}

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
