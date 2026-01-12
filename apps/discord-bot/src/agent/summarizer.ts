import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type {
  ConnpassEvent,
  EventSummaryCache,
  ISummaryCacheStore,
} from '@connpass-discord-bot/core';

/**
 * イベント詳細をAIで要約する
 */
export async function summarizeEventDetails(
  event: ConnpassEvent,
  summaryCache?: ISummaryCacheStore
): Promise<string | null> {
  // OpenAI APIキーがない場合は要約しない
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  // キャッシュをチェック
  if (summaryCache) {
    const cached = await summaryCache.get(event.id);
    if (cached && cached.updatedAt === event.updatedAt) {
      return cached.summary;
    }
  }

  // HTML説明文がない場合は要約しない
  if (!event.description || event.description.trim().length === 0) {
    return null;
  }

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: `あなたはConnpassイベントの説明文を要約するアシスタントです。
以下のルールに従って要約してください：

1. 要約は日本語で、200文字以内で簡潔に
2. 以下の情報を優先的に含める：
   - イベントの目的・テーマ
   - 対象者（初心者向け、経験者向けなど）
   - 参加費（無料/有料）
   - 特徴的な内容
3. HTMLタグは無視し、内容だけを抽出
4. 箇条書きで整理すると読みやすい場合は使用可
5. 不要な挨拶や定型文は省略`,
      prompt: `以下のイベント説明を要約してください：

タイトル: ${event.title}
キャッチコピー: ${event.catchPhrase || 'なし'}

説明:
${event.description}`,
      maxTokens: 300,
    });

    const summary = result.text.trim();

    // キャッシュに保存
    if (summaryCache && summary) {
      const cacheEntry: EventSummaryCache = {
        eventId: event.id,
        updatedAt: event.updatedAt,
        summary,
        cachedAt: new Date().toISOString(),
      };
      await summaryCache.save(cacheEntry);
    }

    return summary;
  } catch (error) {
    console.error('[Summarizer] Error:', error);
    return null;
  }
}
