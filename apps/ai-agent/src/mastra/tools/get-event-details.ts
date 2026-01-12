import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { ConnpassEvent, ISummaryCacheStore } from '@connpass-discord-bot/core';

/**
 * イベント詳細取得ツール
 * イベントIDから詳細情報を取得し、必要に応じてAI要約を提供
 */
export const getEventDetailsTool = createTool({
  id: 'get-event-details',
  description: `イベントIDを指定して詳細情報を取得します。
HTML形式の説明文を含む完全な情報を返します。
要約が必要な場合はsummarize=trueを指定してください。`,
  inputSchema: z.object({
    eventId: z.number().describe('ConnpassイベントID'),
    summarize: z
      .boolean()
      .default(false)
      .describe('AI要約を含めるかどうか'),
  }),
  outputSchema: z.object({
    event: z
      .object({
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
      })
      .nullable(),
    summary: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const client = runtimeContext?.get('connpassClient') as
      | ConnpassClient
      | undefined;
    const summaryCache = runtimeContext?.get('summaryCache') as
      | ISummaryCacheStore
      | undefined;

    if (!client) {
      return {
        event: null,
        message: 'Connpassクライアントが設定されていません',
      };
    }

    try {
      // イベントIDで検索
      const response = await client.searchEvents({
        eventId: [context.eventId],
      });

      const events = response.events as ConnpassEvent[];
      if (events.length === 0) {
        return {
          event: null,
          message: `イベントID ${context.eventId} が見つかりませんでした`,
        };
      }

      const e = events[0];
      const event = {
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
      };

      // 要約が不要な場合はそのまま返す
      if (!context.summarize) {
        return {
          event,
          message: 'イベント詳細を取得しました',
        };
      }

      // キャッシュをチェック
      if (summaryCache) {
        const cached = await summaryCache.get(context.eventId);
        if (cached && cached.updatedAt === e.updatedAt) {
          return {
            event,
            summary: cached.summary,
            message: 'イベント詳細とキャッシュ済み要約を取得しました',
          };
        }
      }

      // 要約が必要だがキャッシュがない場合は、説明文をそのまま返し、
      // エージェントに要約を生成させる
      // (ツール内でLLMを呼ぶのではなく、エージェントが判断する)
      return {
        event,
        message:
          '要約がキャッシュされていません。説明文から要約を生成してください。',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        event: null,
        message: `詳細取得エラー: ${message}`,
      };
    }
  },
});
