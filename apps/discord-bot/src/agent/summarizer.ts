import { generateText } from 'ai';
import type {
  ConnpassEvent,
  EventSummaryCache,
  ISummaryCacheStore,
  ChannelModelConfig,
} from '@connpass-discord-bot/core';
import { getModel, getAIConfig, getModelConfigForChannel, hasApiKey } from '../ai/index.js';

/**
 * イベント詳細をAIで要約する
 * @param event イベント情報
 * @param summaryCache 要約キャッシュストア
 * @param channelModelConfig チャンネル固有のモデル設定（オプション）
 */
export async function summarizeEventDetails(
  event: ConnpassEvent,
  summaryCache?: ISummaryCacheStore,
  channelModelConfig?: ChannelModelConfig | null
): Promise<string | null> {
  // 設定からモデル情報を取得
  const aiConfig = getAIConfig();
  const summarizerConfig = getModelConfigForChannel(aiConfig, 'summarizer', channelModelConfig);

  // 使用するプロバイダーのAPIキーがない場合は要約しない
  if (!hasApiKey(summarizerConfig.provider)) {
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
      model: getModel(summarizerConfig),
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
      maxOutputTokens: 300,
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
