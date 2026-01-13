import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Message, TextChannel, ThreadChannel } from 'discord.js';
import type { ProgressEmbed } from './progress-embed.js';

/**
 * メッセージ概要の型
 */
export interface MessageSummary {
  index: number;
  author: string;
  summary: string;
  isBot: boolean;
  timestamp: string;
}

/**
 * メッセージ詳細の型
 */
export interface MessageDetail {
  author: string;
  content: string;
  timestamp: string;
  isBot: boolean;
  hasEmbed: boolean;
  embedTitle?: string;
}

/**
 * スレッド/チャンネルのメッセージをキャッシュ
 */
let cachedMessages: Message[] = [];
let cachedChannelId: string | null = null;

/**
 * メッセージキャッシュを設定（ハンドラーから呼び出し）
 */
export function setMessageCache(channelId: string, messages: Message[]): void {
  cachedChannelId = channelId;
  cachedMessages = messages;
}

/**
 * メッセージキャッシュをクリア
 */
export function clearMessageCache(): void {
  cachedChannelId = null;
  cachedMessages = [];
}

/**
 * メッセージを要約形式に変換（先頭50文字）
 */
function summarizeMessage(msg: Message): string {
  if (msg.embeds.length > 0 && msg.embeds[0].title) {
    return `[Embed: ${msg.embeds[0].title}]`;
  }
  const content = msg.content.replace(/<@!?\d+>/g, '@user').trim();
  if (!content) return '[添付/リアクションのみ]';
  return content.length > 50 ? content.slice(0, 50) + '...' : content;
}

/**
 * 会話概要取得ツール
 * 直近のメッセージ一覧を概要形式で返す
 */
export const getConversationSummaryTool = createTool({
  id: 'getConversationSummary',
  description: 'スレッド/チャンネルの会話概要を取得。誰が何について話したかの一覧。詳細が必要な場合は getMessage を使用。',
  inputSchema: z.object({
    limit: z.number().min(1).max(20).default(10).describe('取得するメッセージ数（デフォルト10件）'),
  }),
  outputSchema: z.object({
    messages: z.array(z.object({
      index: z.number(),
      author: z.string(),
      summary: z.string(),
      isBot: z.boolean(),
      timestamp: z.string(),
    })),
    totalCount: z.number(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const progress = runtimeContext?.get('progress') as ProgressEmbed | undefined;
    
    // ツール使用開始を記録
    const callId = progress?.addToolCall('getConversationSummary', context);

    const limit = (context as { limit?: number }).limit ?? 10;
    
    if (cachedMessages.length === 0) {
      if (callId) progress?.addToolResult(callId, true, '0件');
      return {
        messages: [],
        totalCount: 0,
      };
    }

    // 新しい順に取得されているので逆順にして、limit件取得
    const targetMessages = cachedMessages.slice(0, limit).reverse();
    
    const summaries: MessageSummary[] = targetMessages.map((msg, idx) => ({
      index: idx,
      author: msg.author.displayName || msg.author.username,
      summary: summarizeMessage(msg),
      isBot: msg.author.bot,
      timestamp: msg.createdAt.toISOString(),
    }));

    // 完了を記録
    if (callId) progress?.addToolResult(callId, true, `${targetMessages.length}件取得`);

    return {
      messages: summaries,
      totalCount: cachedMessages.length,
    };
  },
});

/**
 * 特定メッセージ詳細取得ツール
 */
export const getMessageTool = createTool({
  id: 'getMessage',
  description: '指定したインデックスのメッセージ詳細を取得。getConversationSummary で取得したインデックスを使用。',
  inputSchema: z.object({
    index: z.number().min(0).describe('メッセージのインデックス（getConversationSummaryの結果から）'),
  }),
  outputSchema: z.object({
    author: z.string(),
    content: z.string(),
    timestamp: z.string(),
    isBot: z.boolean(),
    hasEmbed: z.boolean(),
    embedTitle: z.string().optional(),
    embedDescription: z.string().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const progress = runtimeContext?.get('progress') as ProgressEmbed | undefined;
    
    // ツール使用開始を記録
    const callId = progress?.addToolCall('getMessage', context);

    const index = (context as { index: number }).index;
    
    // 逆順にして取得（古い順）
    const targetMessages = [...cachedMessages].reverse();
    
    if (index < 0 || index >= targetMessages.length) {
      if (callId) progress?.addToolResult(callId, false, '見つかりません');
      return {
        author: 'System',
        content: 'メッセージが見つかりません',
        timestamp: new Date().toISOString(),
        isBot: false,
        hasEmbed: false,
      };
    }

    const msg = targetMessages[index];
    const embed = msg.embeds[0];

    // 完了を記録
    const authorName = msg.author.displayName || msg.author.username;
    if (callId) progress?.addToolResult(callId, true, `From: ${authorName}`);

    return {
      author: authorName,
      content: msg.content.replace(/<@!?\d+>/g, '@user').trim() || '[内容なし]',
      timestamp: msg.createdAt.toISOString(),
      isBot: msg.author.bot,
      hasEmbed: msg.embeds.length > 0,
      embedTitle: embed?.title || undefined,
      embedDescription: embed?.description?.slice(0, 200) || undefined,
    };
  },
});

/**
 * 会話コンテキストツール一覧
 */
export const conversationTools = {
  getConversationSummary: getConversationSummaryTool,
  getMessage: getMessageTool,
};
