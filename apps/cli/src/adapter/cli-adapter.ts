/**
 * CLIからコアハンドラーへのアダプター
 */

import {
  handleFeedSetCore,
  handleFeedStatusCore,
  handleFeedRemoveCore,
  type CommandContext,
  type CommandResponse,
  type FeedSetOptions,
  type IScheduler,
  type IFeedStore,
} from '@connpass-discord-bot/core';
import { FileFeedStore } from '@connpass-discord-bot/feed-worker';

// CLI用ダミースケジューラー（実際のスケジューリングは行わない）
class CLIScheduler implements IScheduler {
  constructor(private readonly store: IFeedStore) {}

  async scheduleFeed(channelId: string): Promise<void> {
    // CLI では次回実行日時を計算するのみ
    const feed = await this.store.get(channelId);
    if (!feed) return;

    // 簡易的に1時間後を設定
    feed.state.nextRunAt = Date.now() + 60 * 60 * 1000;
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
let feedStore: FileFeedStore | null = null;
let scheduler: CLIScheduler | null = null;

function getStoreDir(): string {
  return process.env.JOB_STORE_DIR || './data';
}

function initializeStores() {
  if (!feedStore) {
    const storeDir = getStoreDir();
    feedStore = new FileFeedStore(storeDir);
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
  const subcommand = parts[1]; // "set" | "status" | "remove"
  
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
  
  switch (subcommand) {
    case 'status':
      return handleFeedStatusCore(ctx, feedStore);
      
    case 'remove':
      return handleFeedRemoveCore(ctx, feedStore, scheduler);
      
    case 'set':
      return handleFeedSet(ctx, parts.slice(2), feedStore, scheduler);
      
    default:
      return {
        content: `未対応のサブコマンド: feed ${subcommand}\n対応: set, status, remove`,
        ephemeral: true,
      };
  }
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

