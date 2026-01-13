import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IFeedStore, FeedConfig, Feed } from '@connpass-discord-bot/core';
import { DEFAULTS } from '@connpass-discord-bot/core';
import { CronExpressionParser } from 'cron-parser';

/**
 * フィード管理ツール
 * フィード設定の作成、更新、削除、状態確認を行う
 */
export const manageFeedTool = createTool({
  id: 'manage-feed',
  description: `フィード設定を管理します。
- status: 現在のフィード設定を確認
- create: 新しいフィードを作成
- update: 既存のフィードを更新
- delete: フィードを削除
- run: フィードを手動実行（実際の実行はDiscord Bot側で行われます）`,
  inputSchema: z.object({
    action: z
      .enum(['status', 'create', 'update', 'delete', 'run'])
      .describe('実行するアクション'),
    channelId: z
      .string()
      .optional()
      .describe(
        'DiscordチャンネルID（省略時は現在のチャンネル）'
      ),
    config: z
      .object({
        schedule: z
          .string()
          .optional()
          .describe('cron式スケジュール（例: "0 9 * * 1" = 毎週月曜9時）'),
        rangeDays: z
          .number()
          .min(1)
          .max(90)
          .optional()
          .describe('検索範囲日数（1-90）'),
        keywordsAnd: z
          .array(z.string())
          .optional()
          .describe('AND検索キーワード'),
        keywordsOr: z
          .array(z.string())
          .optional()
          .describe('OR検索キーワード'),
        location: z
          .array(z.string())
          .optional()
          .describe('都道府県フィルタ'),
        hashtag: z.string().optional().describe('ハッシュタグフィルタ'),
        ownerNickname: z.string().optional().describe('主催者ニックネーム'),
        minParticipantCount: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('参加人数の下限'),
        minLimit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('募集人数の下限'),
      })
      .optional()
      .describe('フィード設定（create/update時に使用）'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    feed: z
      .object({
        id: z.string(),
        channelId: z.string(),
        schedule: z.string(),
        rangeDays: z.number(),
        keywordsAnd: z.array(z.string()).optional(),
        keywordsOr: z.array(z.string()).optional(),
        location: z.array(z.string()).optional(),
        hashtag: z.string().optional(),
        ownerNickname: z.string().optional(),
        minParticipantCount: z.number().optional(),
        minLimit: z.number().optional(),
        lastRunAt: z.number().optional(),
        nextRunAt: z.number().optional(),
      })
      .nullable(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const feedStore = runtimeContext?.get('feedStore') as
      | IFeedStore
      | undefined;
    const currentChannelId = runtimeContext?.get('channelId') as
      | string
      | undefined;

    if (!feedStore) {
      return {
        success: false,
        feed: null,
        message: 'フィードストアが設定されていません',
      };
    }

    const channelId = context.channelId || currentChannelId;
    if (!channelId) {
      return {
        success: false,
        feed: null,
        message: 'チャンネルIDが指定されていません',
      };
    }

    try {
      switch (context.action) {
        case 'status': {
          const feed = await feedStore.get(channelId);
          if (!feed) {
            return {
              success: true,
              feed: null,
              message: 'このチャンネルにはフィードが設定されていません',
            };
          }
          return {
            success: true,
            feed: formatFeedResponse(feed),
            message: 'フィード設定を取得しました',
          };
        }

        case 'create': {
          const existing = await feedStore.get(channelId);
          if (existing) {
            return {
              success: false,
              feed: formatFeedResponse(existing),
              message:
                'このチャンネルには既にフィードが存在します。updateアクションを使用してください。',
            };
          }

          if (!context.config?.schedule) {
            return {
              success: false,
              feed: null,
              message:
                'フィード作成にはスケジュール(schedule)が必要です',
            };
          }

          // cron式の検証
          try {
            CronExpressionParser.parse(context.config.schedule);
          } catch {
            return {
              success: false,
              feed: null,
              message: `無効なcron式です: ${context.config.schedule}`,
            };
          }

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
            state: {
              sentEvents: {},
            },
          };

          // 次回実行時刻を計算
          const interval = CronExpressionParser.parse(context.config.schedule);
          newFeed.state.nextRunAt = interval.next().getTime();

          await feedStore.save(newFeed);
          return {
            success: true,
            feed: formatFeedResponse(newFeed),
            message: 'フィードを作成しました',
          };
        }

        case 'update': {
          const feed = await feedStore.get(channelId);
          if (!feed) {
            return {
              success: false,
              feed: null,
              message:
                'このチャンネルにはフィードがありません。createアクションを使用してください。',
            };
          }

          if (context.config?.schedule) {
            // cron式の検証
            try {
              CronExpressionParser.parse(context.config.schedule);
              feed.config.schedule = context.config.schedule;
              // 次回実行時刻を再計算
              const interval = CronExpressionParser.parse(context.config.schedule);
              feed.state.nextRunAt = interval.next().getTime();
            } catch {
              return {
                success: false,
                feed: formatFeedResponse(feed),
                message: `無効なcron式です: ${context.config.schedule}`,
              };
            }
          }

          if (context.config?.rangeDays !== undefined) {
            feed.config.rangeDays = context.config.rangeDays;
          }
          if (context.config?.keywordsAnd !== undefined) {
            feed.config.keywordsAnd = context.config.keywordsAnd;
          }
          if (context.config?.keywordsOr !== undefined) {
            feed.config.keywordsOr = context.config.keywordsOr;
          }
          if (context.config?.location !== undefined) {
            feed.config.location = context.config.location;
          }
          if (context.config?.hashtag !== undefined) {
            feed.config.hashtag = context.config.hashtag;
          }
          if (context.config?.ownerNickname !== undefined) {
            feed.config.ownerNickname = context.config.ownerNickname;
          }
          if (context.config?.minParticipantCount !== undefined) {
            feed.config.minParticipantCount = context.config.minParticipantCount;
          }
          if (context.config?.minLimit !== undefined) {
            feed.config.minLimit = context.config.minLimit;
          }

          await feedStore.save(feed);
          return {
            success: true,
            feed: formatFeedResponse(feed),
            message: 'フィードを更新しました',
          };
        }

        case 'delete': {
          const feed = await feedStore.get(channelId);
          if (!feed) {
            return {
              success: true,
              feed: null,
              message: 'このチャンネルにはフィードがありません',
            };
          }

          await feedStore.delete(channelId);
          return {
            success: true,
            feed: null,
            message: 'フィードを削除しました',
          };
        }

        case 'run': {
          const feed = await feedStore.get(channelId);
          if (!feed) {
            return {
              success: false,
              feed: null,
              message:
                'このチャンネルにはフィードがありません。先にcreateでフィードを作成してください。',
            };
          }

          // 実際の実行はDiscord Bot側で行う
          // ここではリクエストを記録するだけ
          return {
            success: true,
            feed: formatFeedResponse(feed),
            message:
              'フィードの手動実行をリクエストしました。Discord Botが処理を行います。',
          };
        }

        default:
          return {
            success: false,
            feed: null,
            message: `不明なアクション: ${context.action}`,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        feed: null,
        message: `フィード操作エラー: ${message}`,
      };
    }
  },
});

function formatFeedResponse(feed: Feed) {
  return {
    id: feed.config.id,
    channelId: feed.config.channelId,
    schedule: feed.config.schedule,
    rangeDays: feed.config.rangeDays,
    keywordsAnd: feed.config.keywordsAnd,
    keywordsOr: feed.config.keywordsOr,
    location: feed.config.location,
    hashtag: feed.config.hashtag,
    ownerNickname: feed.config.ownerNickname,
    minParticipantCount: feed.config.minParticipantCount,
    minLimit: feed.config.minLimit,
    lastRunAt: feed.state.lastRunAt,
    nextRunAt: feed.state.nextRunAt,
  };
}
