import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type {
  ConnpassEvent,
  IFeedStore,
  IUserStore,
  ISummaryCacheStore,
  Feed,
} from '@connpass-discord-bot/core';
import { ORDER_MAP, DEFAULTS } from '@connpass-discord-bot/core';
import { CronExpressionParser } from 'cron-parser';
import { ProgressEmbed } from './progress-embed.js';

// ============================================
// ツール定義
// ============================================

const searchEventsTool = createTool({
  id: 'search-events',
  description: `Search for events on Connpass.
You can filter by keywords, date range, location, etc.`,
  inputSchema: z.object({
    keyword: z.string().optional().describe('Search keywords'),
    prefecture: z.string().optional().describe('Prefecture name (e.g. Tokyo)'),
    ymdFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    ymdTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
    ownerNickname: z.string().optional().describe('Organizer nickname'),
    count: z.number().min(1).max(30).default(10).describe('Number of items to retrieve'),
  }),
  outputSchema: z.object({
    events: z.array(z.object({
      id: z.number(),
      title: z.string(),
      catchPhrase: z.string(),
      url: z.string(),
      startedAt: z.string(),
      endedAt: z.string(),
      place: z.string().optional(),
      address: z.string().optional(),
      participantCount: z.number(),
      limit: z.number().optional(),
      waitingCount: z.number(),
      ownerDisplayName: z.string(),
      hashTag: z.string(),
    })),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const progress = runtimeContext?.get('progress') as ProgressEmbed | undefined;
    progress?.addToolCall('searchEvents', context);

    const client = runtimeContext?.get('connpassClient') as ConnpassClient | undefined;
    if (!client) {
      return { events: [], total: 0, message: 'クライアント未設定' };
    }

    const now = new Date();
    const twoWeeks = new Date(now);
    twoWeeks.setDate(now.getDate() + 14);

    const params: Record<string, unknown> = {
      ymdFrom: context.ymdFrom || formatYmd(now),
      ymdTo: context.ymdTo || formatYmd(twoWeeks),
      count: context.count || 10,
      order: ORDER_MAP['started_asc'],
    };

    if (context.keyword) params.keyword = [context.keyword];
    if (context.prefecture) params.prefecture = [context.prefecture];
    if (context.ownerNickname) params.ownerNickname = context.ownerNickname;

    try {
      const response = await client.searchEvents(params);
      const events = (response.events as ConnpassEvent[]).map((e) => ({
        id: e.id,
        title: e.title,
        catchPhrase: e.catchPhrase || '',
        url: e.url,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        place: e.place,
        address: e.address,
        participantCount: e.participantCount,
        limit: e.limit,
        waitingCount: e.waitingCount,
        ownerDisplayName: e.ownerDisplayName,
        hashTag: e.hashTag || '',
      }));

      progress?.addToolResult('searchEvents', true, `${events.length}件`);

      return {
        events,
        total: events.length,
        message: events.length > 0
          ? `${events.length}件見つかりました`
          : '見つかりませんでした',
      };
    } catch (error) {
      progress?.addToolResult('searchEvents', false, 'エラー');
      return { events: [], total: 0, message: `エラー: ${error}` };
    }
  },
});

const getEventDetailsTool = createTool({
  id: 'get-event-details',
  description: 'Get detailed information for a specific event ID.',
  inputSchema: z.object({
    eventId: z.number().describe('Connpass Event ID'),
  }),
  outputSchema: z.object({
    event: z.object({
      id: z.number(),
      title: z.string(),
      catchPhrase: z.string(),
      description: z.string(),
      url: z.string(),
      startedAt: z.string(),
      endedAt: z.string(),
      place: z.string().optional(),
      address: z.string().optional(),
      participantCount: z.number(),
      limit: z.number().optional(),
      waitingCount: z.number(),
      ownerDisplayName: z.string(),
      ownerNickname: z.string(),
      hashTag: z.string(),
      groupTitle: z.string().optional(),
      groupUrl: z.string().optional(),
    }).nullable(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const progress = runtimeContext?.get('progress') as ProgressEmbed | undefined;
    progress?.addToolCall('getEventDetails', context);

    const client = runtimeContext?.get('connpassClient') as ConnpassClient | undefined;
    if (!client) {
      return { event: null, message: 'クライアント未設定' };
    }

    try {
      const response = await client.searchEvents({ eventId: [context.eventId] });
      const events = response.events as ConnpassEvent[];

      if (events.length === 0) {
        progress?.addToolResult('getEventDetails', false, '見つかりません');
        return { event: null, message: `ID ${context.eventId} が見つかりません` };
      }

      const e = events[0];
      progress?.addToolResult('getEventDetails', true, e.title.slice(0, 15) + '...');
      
      return {
        event: {
          id: e.id,
          title: e.title,
          catchPhrase: e.catchPhrase || '',
          description: e.description || '',
          url: e.url,
          startedAt: e.startedAt,
          endedAt: e.endedAt,
          place: e.place,
          address: e.address,
          participantCount: e.participantCount,
          limit: e.limit,
          waitingCount: e.waitingCount,
          ownerDisplayName: e.ownerDisplayName,
          ownerNickname: e.ownerNickname,
          hashTag: e.hashTag || '',
          groupTitle: e.groupTitle,
          groupUrl: e.groupUrl,
        },
        message: '取得しました',
      };
    } catch (error) {
      progress?.addToolResult('getEventDetails', false, 'エラー');
      return { event: null, message: `エラー: ${error}` };
    }
  },
});

const getUserScheduleTool = createTool({
  id: 'get-user-schedule',
  description: 'Get the user\'s scheduled/participating events. If no nickname is specified, it automatically uses the registered nickname linked to the Discord User ID.',
  inputSchema: z.object({
    nickname: z.string().optional().describe('Connpass nickname. If omitted, uses the registered user info.'),
    daysAhead: z.number().min(1).max(90).default(30).describe('Days to look ahead'),
  }),
  outputSchema: z.object({
    nickname: z.string().optional(),
    events: z.array(z.object({
      id: z.number(),
      title: z.string(),
      url: z.string(),
      startedAt: z.string(),
      endedAt: z.string(),
      place: z.string().optional(),
      participantCount: z.number(),
      limit: z.number().optional(),
    })),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const progress = runtimeContext?.get('progress') as ProgressEmbed | undefined;
    progress?.addToolCall('getUserSchedule', context);

    const client = runtimeContext?.get('connpassClient') as ConnpassClient | undefined;
    const userStore = runtimeContext?.get('userStore') as IUserStore | undefined;
    const discordUserId = runtimeContext?.get('discordUserId') as string | undefined;

    if (!client) {
      return { events: [], total: 0, message: 'クライアント未設定' };
    }

    let nickname = context.nickname;
    if (!nickname && userStore && discordUserId) {
      const user = await userStore.find(discordUserId);
      if (user) nickname = user.connpassNickname;
    }

    if (!nickname) {
      progress?.addToolResult('getUserSchedule', false, 'ニックネーム必須');
      return {
        events: [],
        total: 0,
        message: 'ニックネームを指定するか、/connpass user register で登録してください',
      };
    }

    const now = new Date();
    const future = new Date(now);
    future.setDate(now.getDate() + (context.daysAhead || 30));

    try {
      const response = await client.searchEvents({
        nickname,
        ymdFrom: formatYmd(now),
        ymdTo: formatYmd(future),
        order: 2, // started_asc
        count: 50,
      });

      const events = (response.events as ConnpassEvent[]).map((e) => ({
        id: e.id,
        title: e.title,
        url: e.url,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        place: e.place,
        participantCount: e.participantCount,
        limit: e.limit,
      }));

      progress?.addToolResult('getUserSchedule', true, `${events.length}件`);

      return {
        nickname,
        events,
        total: events.length,
        message: events.length > 0
          ? `${nickname}さんの予定: ${events.length}件`
          : `${nickname}さんの予定はありません`,
      };
    } catch (error) {
      progress?.addToolResult('getUserSchedule', false, 'エラー');
      return { nickname, events: [], total: 0, message: `エラー: ${error}` };
    }
  },
});

const manageFeedTool = createTool({
  id: 'manage-feed',
  description: 'Manage feed settings (status/create/update/delete)',
  inputSchema: z.object({
    action: z.enum(['status', 'create', 'update', 'delete']).describe('Action to perform'),
    channelId: z.string().optional().describe('Channel ID'),
    config: z.object({
      schedule: z.string().optional(),
      rangeDays: z.number().optional(),
      keywordsAnd: z.array(z.string()).optional(),
      keywordsOr: z.array(z.string()).optional(),
      location: z.array(z.string()).optional(),
      hashtag: z.string().optional(),
      ownerNickname: z.string().optional(),
      minParticipantCount: z.number().optional(),
      minLimit: z.number().optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    feed: z.object({
      id: z.string(),
      schedule: z.string(),
      rangeDays: z.number(),
      keywordsAnd: z.array(z.string()).optional(),
      keywordsOr: z.array(z.string()).optional(),
      location: z.array(z.string()).optional(),
      hashtag: z.string().optional(),
      minParticipantCount: z.number().optional(),
      minLimit: z.number().optional(),
      nextRunAt: z.number().optional(),
    }).nullable(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const progress = runtimeContext?.get('progress') as ProgressEmbed | undefined;
    progress?.addToolCall('manageFeed', context);

    const feedStore = runtimeContext?.get('feedStore') as IFeedStore | undefined;
    const currentChannelId = runtimeContext?.get('channelId') as string | undefined;

    if (!feedStore) {
      return { success: false, feed: null, message: 'ストア未設定' };
    }

    const channelId = context.channelId || currentChannelId;
    if (!channelId) {
      return { success: false, feed: null, message: 'チャンネルID不明' };
    }

    try {
      let resultMessage = '';
      switch (context.action) {
        case 'status': {
          const feed = await feedStore.get(channelId);
          if (!feed) {
            resultMessage = '未設定';
            progress?.addToolResult('manageFeed', true, resultMessage);
            return { success: true, feed: null, message: 'フィード未設定' };
          }
          resultMessage = '設定取得';
          progress?.addToolResult('manageFeed', true, resultMessage);
          return { success: true, feed: formatFeed(feed), message: '取得しました' };
        }

        case 'create': {
          if (!context.config?.schedule) {
            progress?.addToolResult('manageFeed', false, 'schedule不足');
            return { success: false, feed: null, message: 'scheduleが必要です' };
          }
          const existing = await feedStore.get(channelId);
          if (existing) {
            progress?.addToolResult('manageFeed', false, '既に存在');
            return { success: false, feed: formatFeed(existing), message: '既に存在します' };
          }

          const cron = CronExpressionParser.parse(context.config.schedule, { tz: 'Asia/Tokyo' });
          const nextRun = cron.next();
          const newFeed: Feed = {
            config: {
              id: channelId,
              channelId,
              schedule: context.config.schedule,
              rangeDays: context.config.rangeDays || DEFAULTS.RANGE_DAYS,
              keywordsAnd: context.config.keywordsAnd,
              keywordsOr: context.config.keywordsOr,
              location: context.config.location,
              hashtag: context.config.hashtag,
              ownerNickname: context.config.ownerNickname,
              minParticipantCount: context.config.minParticipantCount,
              minLimit: context.config.minLimit,
            },
            state: { sentEvents: {}, nextRunAt: nextRun.getTime() },
          };
          await feedStore.save(newFeed);
          progress?.addToolResult('manageFeed', true, '作成完了');
          return { success: true, feed: formatFeed(newFeed), message: '作成しました' };
        }

        case 'update': {
          const feed = await feedStore.get(channelId);
          if (!feed) {
             progress?.addToolResult('manageFeed', false, '未設定');
            return { success: false, feed: null, message: 'フィードがありません' };
          }
          if (context.config?.schedule) {
            const cron = CronExpressionParser.parse(context.config.schedule, { tz: 'Asia/Tokyo' });
            feed.config.schedule = context.config.schedule;
            feed.state.nextRunAt = cron.next().getTime();
          }
          if (context.config?.rangeDays) feed.config.rangeDays = context.config.rangeDays;
          if (context.config?.keywordsAnd) feed.config.keywordsAnd = context.config.keywordsAnd;
          if (context.config?.keywordsOr) feed.config.keywordsOr = context.config.keywordsOr;
          if (context.config?.location) feed.config.location = context.config.location;
          if (context.config?.hashtag) feed.config.hashtag = context.config.hashtag;
          if (context.config?.minParticipantCount !== undefined) {
            feed.config.minParticipantCount = context.config.minParticipantCount;
          }
          if (context.config?.minLimit !== undefined) {
            feed.config.minLimit = context.config.minLimit;
          }
          await feedStore.save(feed);
          progress?.addToolResult('manageFeed', true, '更新完了');
          return { success: true, feed: formatFeed(feed), message: '更新しました' };
        }

        case 'delete': {
          await feedStore.delete(channelId);
          progress?.addToolResult('manageFeed', true, '削除完了');
          return { success: true, feed: null, message: '削除しました' };
        }

        default:
          progress?.addToolResult('manageFeed', false, '不明な操作');
          return { success: false, feed: null, message: '不明なアクション' };
      }
    } catch (error) {
      progress?.addToolResult('manageFeed', false, 'エラー');
      return { success: false, feed: null, message: `エラー: ${error}` };
    }
  },
});

function formatFeed(feed: Feed) {
  return {
    id: feed.config.id,
    schedule: feed.config.schedule,
    rangeDays: feed.config.rangeDays,
    keywordsAnd: feed.config.keywordsAnd,
    keywordsOr: feed.config.keywordsOr,
    location: feed.config.location,
    hashtag: feed.config.hashtag,
    minParticipantCount: feed.config.minParticipantCount,
    minLimit: feed.config.minLimit,
    nextRunAt: feed.state.nextRunAt,
  };
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================
// メモリ設定
// ============================================

const storage = new LibSQLStore({
  url: process.env.AGENT_DATABASE_URL || 'file:./data/agent-memory.db',
});

const memory = new Memory({
  storage,
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# ユーザー情報
- Connpassニックネーム:
- よく検索するキーワード:
- 興味のある分野:
- よく参加するイベントの種類:
`,
    },
  },
});

// ============================================
// エージェント定義
// ============================================

import { RuntimeContext } from '@mastra/core/runtime-context';

export const connpassAgent = new Agent({
  name: 'Connpass Assistant',
  instructions: async ({ runtimeContext }) => {
    const baseInstructions = `あなたはConnpassイベントの検索・管理をサポートする日本語アシスタントです。

## 役割
1. イベント検索: ユーザーの興味に合わせてイベントを探す
2. イベント詳細: 詳細情報を提供し要約する
3. スケジュール確認: 参加予定イベントを確認
4. フィード管理: 定期通知設定をサポート

## Discord出力フォーマット
- 見出しは **太字** を使用
- リストは - を使用
- イベント名は **太字** で表示
- 日時は YYYY/MM/DD HH:mm 形式
- リンクは [テキスト](URL) 形式

## イベント表示例
**検索結果: 3件**

- **[イベント名](URL)**
  📅 2025/01/20 19:00〜 | 📍 渋谷
  👥 30/50人 | 主催: xxx

## 注意
- 日本語で回答
- ユーザーの興味をワーキングメモリに記録
- HTML説明は重要情報を抽出して要約
- 「私のイベント」や「予定」について聞かれた際は、ニックネームを聞き返さずに getUserSchedule を引数なし（または必要な日数のみ）で呼び出してください。ツール側で自動的に登録情報を参照します。`;

    const eventContext = runtimeContext?.get('eventContext') as string | undefined;
    if (eventContext) {
      return `${baseInstructions}\n${eventContext}`;
    }
    return baseInstructions;
  },
  model: openai.responses('gpt-5-mini'),
  tools: {
    searchEvents: searchEventsTool,
    getEventDetails: getEventDetailsTool,
    getUserSchedule: getUserScheduleTool,
    manageFeed: manageFeedTool,
  },
  memory,
});
