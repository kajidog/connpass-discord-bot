import { Client, GatewayIntentBits, Events, Message, ChannelType, Partials } from 'discord.js';
import { ConnpassClient } from '@kajidog/connpass-api-client';
import type {
  IFeedStore,
  IUserStore,
  IAdminStore,
  IBanStore,
  ISummaryCacheStore,
  IChannelModelStore,
  IUserNotifySettingsStore,
  IUserNotifySentStore,
  ILogWriter,
} from '@connpass-discord-bot/core';
import {
  Logger,
  ConsoleLogWriter,
  LogLevel,
  LogDestination,
  parseLogLevel,
  parseLogDestination,
} from '@connpass-discord-bot/core';
import {
  FileFeedStore,
  FileUserStore,
  FileAdminStore,
  FileBanStore,
  FileSummaryCacheStore,
  FileChannelModelStore,
  DrizzleFeedStore,
  DrizzleUserStore,
  DrizzleAdminStore,
  DrizzleBanStore,
  DrizzleSummaryCacheStore,
  DrizzleChannelModelStore,
  DrizzleUserNotifySettingsStore,
  DrizzleUserNotifySentStore,
  DrizzleLogWriter,
  createDatabase,
  FeedExecutor,
  Scheduler,
  NotifyScheduler,
} from '@connpass-discord-bot/feed-worker';
import { DiscordSink } from './sink/DiscordSink.js';
import { DMNotifySink } from './sink/DMNotifySink.js';
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
import { handleAdminCommand } from './commands/handlers/admin.js';
import { handleToday } from './commands/handlers/today.js';
import { handleHelp } from './commands/handlers/help.js';
import {
  handleNotifyOn,
  handleNotifyOff,
  handleNotifyStatus,
} from './commands/handlers/notify.js';
import { handleAgentMentionWithProgress, type AgentContext } from './agent/index.js';

// 環境変数チェック
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CONNPASS_API_KEY = process.env.CONNPASS_API_KEY;
const JOB_STORE_DIR = process.env.JOB_STORE_DIR || './data';
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'file';
const DATABASE_URL = process.env.DATABASE_URL || `${JOB_STORE_DIR}/app.db`;

// ログ設定
const LOG_LEVEL = parseLogLevel(process.env.LOG_LEVEL || 'info');
const LOG_DESTINATION = parseLogDestination(process.env.LOG_DESTINATION || 'console');

// ロガー初期化（早期に初期化してエラーログも記録できるようにする）
const logger = Logger.initialize(LOG_LEVEL);
logger.addWriter(new ConsoleLogWriter());

// DBロガーは後で追加（DB初期化後）
let dbLogWriter: ILogWriter | undefined;

if (!DISCORD_BOT_TOKEN) {
  logger.error('Bot', 'DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

if (!CONNPASS_API_KEY) {
  logger.error('Bot', 'CONNPASS_API_KEY is required');
  process.exit(1);
}

// AI機能フラグ
const ENABLE_AI_AGENT = process.env.ENABLE_AI_AGENT !== 'false';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// イベント通知機能フラグ
const ENABLE_EVENT_NOTIFY = process.env.ENABLE_EVENT_NOTIFY !== 'false';
const NOTIFY_CHECK_INTERVAL_MS = parseInt(
  process.env.NOTIFY_CHECK_INTERVAL_MS || '60000',
  10
);

if (ENABLE_AI_AGENT && !OPENAI_API_KEY) {
  logger.warn('Bot', 'OPENAI_API_KEY is not set, AI agent will be disabled');
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
let feedStore: IFeedStore;
let userStore: IUserStore;
let adminStore: IAdminStore;
let banStore: IBanStore;
let summaryCache: ISummaryCacheStore;
let channelModelStore: IChannelModelStore;
let notifySettingsStore: IUserNotifySettingsStore | undefined;
let notifySentStore: IUserNotifySentStore | undefined;

if (STORAGE_TYPE === 'sqlite') {
  logger.info('Bot', 'Using SQLite storage', { databaseUrl: DATABASE_URL });
  const { db } = createDatabase(DATABASE_URL);
  feedStore = new DrizzleFeedStore(db);
  userStore = new DrizzleUserStore(db);
  adminStore = new DrizzleAdminStore(db);
  banStore = new DrizzleBanStore(db);
  summaryCache = new DrizzleSummaryCacheStore(db);
  channelModelStore = new DrizzleChannelModelStore(db);
  notifySettingsStore = new DrizzleUserNotifySettingsStore(db);
  notifySentStore = new DrizzleUserNotifySentStore(db);

  // DBログライターを追加
  if (LOG_DESTINATION === LogDestination.DATABASE || LOG_DESTINATION === LogDestination.BOTH) {
    dbLogWriter = new DrizzleLogWriter(db);
    logger.addWriter(dbLogWriter);
    logger.info('Bot', 'Database logging enabled');
  }
} else {
  logger.info('Bot', 'Using File storage', { storeDir: JOB_STORE_DIR });
  feedStore = new FileFeedStore(JOB_STORE_DIR);
  userStore = new FileUserStore(JOB_STORE_DIR);
  adminStore = new FileAdminStore(JOB_STORE_DIR);
  banStore = new FileBanStore(JOB_STORE_DIR);
  summaryCache = new FileSummaryCacheStore(JOB_STORE_DIR);
  channelModelStore = new FileChannelModelStore(JOB_STORE_DIR);

  // Fileストレージの場合、DBログは使用不可
  if (LOG_DESTINATION === LogDestination.DATABASE || LOG_DESTINATION === LogDestination.BOTH) {
    logger.warn('Bot', 'Database logging requires SQLite storage, falling back to console only');
  }
}

// シンク・エグゼキュータ・スケジューラー初期化
const sink = new DiscordSink(discordClient);
const executor = new FeedExecutor(connpassClient, feedStore, sink);
const scheduler = new Scheduler(feedStore, executor);

// 通知スケジューラー初期化（SQLite使用時のみ）
let notifyScheduler: NotifyScheduler | undefined;
if (ENABLE_EVENT_NOTIFY && notifySettingsStore && notifySentStore) {
  const dmNotifySink = new DMNotifySink(discordClient);
  notifyScheduler = new NotifyScheduler(
    userStore,
    notifySettingsStore,
    notifySentStore,
    connpassClient,
    dmNotifySink,
    { checkIntervalMs: NOTIFY_CHECK_INTERVAL_MS }
  );
  logger.info('Bot', 'Event notification enabled', { checkIntervalMs: NOTIFY_CHECK_INTERVAL_MS });
} else if (ENABLE_EVENT_NOTIFY && STORAGE_TYPE !== 'sqlite') {
  logger.warn('Bot', 'Event notification requires SQLite storage');
}

// AIエージェントコンテキスト
const agentContext: AgentContext = {
  connpassClient,
  feedStore,
  userStore,
  summaryCache,
  channelModelStore,
  banStore,
  notifySettingsStore,
};

// Discord準備完了
discordClient.once(Events.ClientReady, async (c) => {
  logger.info('Discord', `Ready! Logged in as ${c.user.tag}`, { userId: c.user.id });

  // スケジューラー開始
  await scheduler.start();

  // 通知スケジューラー開始
  if (notifyScheduler) {
    await notifyScheduler.start();
  }
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
      await handleButtonInteraction(
        interaction,
        connpassClient,
        userStore,
        summaryCache,
        channelModelStore,
        banStore
      );
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
            await handleFeedSet(interaction, feedStore, scheduler, banStore);
            break;
          case 'status':
            await handleFeedStatus(interaction, feedStore);
            break;
          case 'remove':
            await handleFeedRemove(interaction, feedStore, scheduler, banStore);
            break;
          case 'run':
            await handleFeedRun(interaction, feedStore, executor, banStore);
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
        await handleModelCommand(interaction, channelModelStore, banStore);
        return;
      }

      // /connpass admin *
      if (group === 'admin') {
        await handleAdminCommand(interaction, adminStore, banStore);
        return;
      }

      // /connpass notify *
      if (group === 'notify') {
        if (!notifySettingsStore) {
          await interaction.reply({
            content: '❌ 通知機能はSQLiteストレージ使用時のみ利用可能です。\n`STORAGE_TYPE=sqlite` を設定してください。',
            ephemeral: true,
          });
          return;
        }
        switch (subcommand) {
          case 'on':
            await handleNotifyOn(interaction, userStore, notifySettingsStore);
            break;
          case 'off':
            await handleNotifyOff(interaction, notifySettingsStore);
            break;
          case 'status':
            await handleNotifyStatus(interaction, userStore, notifySettingsStore);
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
    logger.error('Discord', 'Interaction error', {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });

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
      logger.error('Agent', 'Error handling mention', {
        error: error instanceof Error ? error.message : String(error),
        userId: message.author.id,
        guildId: message.guildId,
        channelId: message.channelId,
      });
      try {
        await message.reply('申し訳ありません。エラーが発生しました。');
      } catch {
        // 返信に失敗した場合は無視
      }
    }
  });

  logger.info('Bot', 'AI Agent enabled');
}

// グレースフルシャットダウン
async function shutdown() {
  logger.info('Bot', 'Shutting down...');
  await scheduler.stop();
  if (notifyScheduler) {
    await notifyScheduler.stop();
  }
  discordClient.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ボット起動
discordClient.login(DISCORD_BOT_TOKEN);
