import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { ConnpassEvent, IUserStore } from '@connpass-discord-bot/core';
import { ORDER_MAP } from '@connpass-discord-bot/core';

/**
 * ユーザースケジュール取得ツール
 * 登録済みユーザーまたは指定ニックネームの参加予定イベントを取得
 */
export const getUserScheduleTool = createTool({
  id: 'get-user-schedule',
  description: `ユーザーの参加予定イベントを取得します。
Connpassニックネームを指定するか、Discordで登録済みのユーザーのスケジュールを確認できます。`,
  inputSchema: z.object({
    nickname: z
      .string()
      .optional()
      .describe(
        'Connpassニックネーム（省略時は会話中のDiscordユーザーの登録情報を使用）'
      ),
    daysAhead: z
      .number()
      .min(1)
      .max(90)
      .default(30)
      .describe('何日先までのイベントを取得するか（1-90、デフォルト30）'),
  }),
  outputSchema: z.object({
    nickname: z.string().optional(),
    events: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        url: z.string(),
        startedAt: z.string(),
        endedAt: z.string(),
        place: z.string().optional(),
        participantCount: z.number(),
        limit: z.number().optional(),
      })
    ),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const client = runtimeContext?.get('connpassClient') as
      | ConnpassClient
      | undefined;
    const userStore = runtimeContext?.get('userStore') as
      | IUserStore
      | undefined;
    const discordUserId = runtimeContext?.get('discordUserId') as
      | string
      | undefined;

    if (!client) {
      return {
        events: [],
        total: 0,
        message: 'Connpassクライアントが設定されていません',
      };
    }

    // ニックネームを解決
    let nickname = context.nickname;

    if (!nickname && userStore && discordUserId) {
      // Discordユーザーから登録情報を取得
      const user = await userStore.find(discordUserId);
      if (user) {
        nickname = user.connpassNickname;
      }
    }

    if (!nickname) {
      return {
        events: [],
        total: 0,
        message:
          'ニックネームが指定されておらず、Discordユーザーの登録情報も見つかりませんでした。' +
          '/connpass user register でConnpassアカウントを登録するか、ニックネームを直接指定してください。',
      };
    }

    try {
      // 日付範囲を設定
      const now = new Date();
      const ymdFrom = formatYmd(now);
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + (context.daysAhead || 30));
      const ymdTo = formatYmd(futureDate);

      const response = await client.searchEvents({
        nickname: nickname,
        ymdFrom,
        ymdTo,
        order: ORDER_MAP['started_asc'],
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

      return {
        nickname,
        events,
        total: events.length,
        message:
          events.length > 0
            ? `${nickname}さんの今後${context.daysAhead || 30}日間の参加予定: ${events.length}件`
            : `${nickname}さんの参加予定イベントはありません`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        nickname,
        events: [],
        total: 0,
        message: `スケジュール取得エラー: ${message}`,
      };
    }
  },
});

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
