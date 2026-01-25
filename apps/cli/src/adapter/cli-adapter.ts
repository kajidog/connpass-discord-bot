/**
 * CLIからコアハンドラーへのアダプター
 */

import {
  handleFeedSetCore,
  handleFeedStatusCore,
  handleFeedRemoveCore,
  ActionType,
  type CommandContext,
  type CommandResponse,
  type FeedSetOptions,
  type IScheduler,
  type IFeedStore,
} from '@connpass-discord-bot/core';
import { calculateNextRunTime } from '@connpass-discord-bot/feed-worker';
import { getLogReader } from './db-adapter.js';
import { formatLogsAsText } from '../components/FeedLogViewer.js';
import { createFeedStoreFromEnv } from './storage.js';

/**
 * Discord Markdownを除去してプレーンテキストに変換
 */
function stripMarkdown(text: string): string {
  return text
    // **bold** -> bold
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // *italic* -> italic
    .replace(/\*([^*]+)\*/g, '$1')
    // __underline__ -> underline
    .replace(/__([^_]+)__/g, '$1')
    // ~~strikethrough~~ -> strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // `code` -> code
    .replace(/`([^`]+)`/g, '$1')
    // > quote -> quote
    .replace(/^>\s*/gm, '');
}

// CLI用スケジューラー（次回実行日時を正しく計算）
class CLIScheduler implements IScheduler {
  constructor(private readonly store: IFeedStore) {}

  async scheduleFeed(channelId: string): Promise<void> {
    const feed = await this.store.get(channelId);
    if (!feed) return;

    // cronスケジュールから次回実行日時を計算
    feed.state.nextRunAt = calculateNextRunTime(feed.config.schedule);
    await this.store.save(feed);
  }

  async unscheduleFeed(channelId: string): Promise<void> {
    const feed = await this.store.get(channelId);
    if (feed) {
      feed.state.nextRunAt = undefined;
      await this.store.save(feed);
    }
  }
}

// ストアとスケジューラーの初期化（シングルトン）
let feedStore: IFeedStore | null = null;
let scheduler: CLIScheduler | null = null;

function initializeStores() {
  if (!feedStore) {
    feedStore = createFeedStoreFromEnv();
    scheduler = new CLIScheduler(feedStore);
  }
  
  return { feedStore: feedStore!, scheduler: scheduler! };
}

/**
 * コマンド文字列をパースして実行
 */
export async function executeCommand(
  commandStr: string,
  channelId: string
): Promise<CommandResponse> {
  const { feedStore, scheduler } = initializeStores();
  
  // /connpass を除去してパース
  const normalized = commandStr.replace(/^\/connpass\s*/, '').trim();
  const parts = normalized.split(/\s+/);
  
  const group = parts[0]; // "feed"
  const subcommand = parts[1]; // "set" | "status" | "remove" | "logs"

  if (group !== 'feed') {
    return {
      content: `未対応のコマンドグループ: ${group}\n現在対応: feed`,
      ephemeral: true,
    };
  }

  const ctx: CommandContext = {
    channelId,
    userId: 'cli-user',
    guildId: undefined,
  };

  let result: CommandResponse;

  switch (subcommand) {
    case 'status':
      result = await handleFeedStatusCore(ctx, feedStore);
      break;

    case 'remove':
      result = await handleFeedRemoveCore(ctx, feedStore, scheduler);
      break;

    case 'set':
      result = await handleFeedSet(ctx, parts.slice(2), feedStore, scheduler);
      break;

    case 'logs':
      return handleLogsCommand(channelId);

    default:
      return {
        content: `未対応のサブコマンド: feed ${subcommand}\n対応: set, status, remove, logs`,
        ephemeral: true,
      };
  }

  // Discord Markdownを除去
  return {
    ...result,
    content: stripMarkdown(result.content),
  };
}

/**
 * feed set コマンドのオプションをパース
 * 形式: key:value key:value ...
 * 例: schedule:0 9 * * * keywords_and:TypeScript,React
 */
function parseSetOptions(args: string[]): FeedSetOptions {
  const options: FeedSetOptions = {
    schedule: '0 9 * * *', // デフォルト
  };
  
  // 引数を key:value 形式でパース
  const joined = args.join(' ');
  const matches = joined.matchAll(/(\w+):([^\s]+(?:\s+[^\s:]+)*?)(?=\s+\w+:|$)/g);
  
  for (const match of matches) {
    const key = match[1];
    const value = match[2].trim();
    
    switch (key) {
      case 'schedule':
        options.schedule = value;
        break;
      case 'custom_schedule':
        options.customSchedule = value;
        break;
      case 'keywords_and':
        options.keywordsAnd = value;
        break;
      case 'keywords_or':
        options.keywordsOr = value;
        break;
      case 'range_days':
        options.rangeDays = parseInt(value, 10);
        break;
      case 'location':
        options.location = value;
        break;
      case 'hashtag':
        options.hashtag = value;
        break;
      case 'owner_nickname':
        options.ownerNickname = value;
        break;
      case 'order':
        options.order = value as FeedSetOptions['order'];
        break;
      case 'min_participants':
        options.minParticipants = parseInt(value, 10);
        break;
      case 'min_limit':
        options.minLimit = parseInt(value, 10);
        break;
      case 'use_ai':
        options.useAi = value === 'true';
        break;
    }
  }
  
  return options;
}

async function handleFeedSet(
  ctx: CommandContext,
  args: string[],
  feedStore: IFeedStore,
  scheduler: IScheduler
): Promise<CommandResponse> {
  const options = parseSetOptions(args);
  return handleFeedSetCore(ctx, options, feedStore, scheduler);
}

/**
 * /connpass feed logs コマンドを処理
 */
async function handleLogsCommand(channelId: string): Promise<CommandResponse> {
  const logReader = getLogReader();

  if (!logReader) {
    return {
      content: 'ログDBに接続できません。\nDB_PATH環境変数を確認してください。',
      ephemeral: true,
    };
  }

  try {
    // Feed実行に関連するログを取得
    const logs = await logReader.getActionLogs({
      channelId,
      actionTypes: [
        ActionType.SCHEDULER_EXECUTE,
        ActionType.SCHEDULER_START,
        ActionType.SCHEDULER_STOP,
        ActionType.SCHEDULER_ERROR,
        ActionType.NOTIFY_SEND,
        ActionType.NOTIFY_ERROR,
        ActionType.SCHEDULE_CREATE,
        ActionType.SCHEDULE_UPDATE,
        ActionType.SCHEDULE_DELETE,
      ],
      limit: 20,
    });

    const text = formatLogsAsText(logs);
    return { content: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: `ログ取得エラー: ${message}`,
      ephemeral: true,
    };
  }
}
