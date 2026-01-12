import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { ConnpassEvent } from '@connpass-discord-bot/core';
import { ORDER_MAP } from '@connpass-discord-bot/core';

/**
 * イベント検索ツール
 * Connpass APIを使用してイベントを検索する
 */
export const searchEventsTool = createTool({
  id: 'search-events',
  description: `Connpassでイベントを検索します。
キーワード、日付範囲、場所などで絞り込みが可能です。
結果には最大10件のイベントが含まれます。`,
  inputSchema: z.object({
    keyword: z
      .string()
      .optional()
      .describe('検索キーワード（タイトル・説明文に含まれる語句）'),
    prefecture: z
      .string()
      .optional()
      .describe('都道府県名（例: 東京都, 大阪府）'),
    ymdFrom: z
      .string()
      .optional()
      .describe('開始日（YYYY-MM-DD形式、省略時は今日）'),
    ymdTo: z
      .string()
      .optional()
      .describe('終了日（YYYY-MM-DD形式、省略時は2週間後）'),
    ownerNickname: z
      .string()
      .optional()
      .describe('主催者のConnpassニックネーム'),
    count: z
      .number()
      .min(1)
      .max(30)
      .default(10)
      .describe('取得件数（1-30、デフォルト10）'),
  }),
  outputSchema: z.object({
    events: z.array(
      z.object({
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
      })
    ),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const client = runtimeContext?.get('connpassClient') as
      | ConnpassClient
      | undefined;

    if (!client) {
      return {
        events: [],
        total: 0,
        message: 'Connpassクライアントが設定されていません',
      };
    }

    try {
      // 日付のデフォルト値を設定
      const now = new Date();
      const defaultYmdFrom = formatYmd(now);
      const twoWeeksLater = new Date(now);
      twoWeeksLater.setDate(now.getDate() + 14);
      const defaultYmdTo = formatYmd(twoWeeksLater);

      const params: Record<string, unknown> = {
        ymdFrom: context.ymdFrom || defaultYmdFrom,
        ymdTo: context.ymdTo || defaultYmdTo,
        count: context.count || 10,
        order: ORDER_MAP['started_asc'],
      };

      if (context.keyword) {
        params.keyword = [context.keyword];
      }
      if (context.prefecture) {
        params.prefecture = [context.prefecture];
      }
      if (context.ownerNickname) {
        params.ownerNickname = context.ownerNickname;
      }

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

      return {
        events,
        total: response.resultsAvailable || events.length,
        message:
          events.length > 0
            ? `${events.length}件のイベントが見つかりました`
            : '条件に合うイベントが見つかりませんでした',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        events: [],
        total: 0,
        message: `検索エラー: ${message}`,
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
