import { Message, TextChannel, ThreadChannel } from 'discord.js';
import { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { IFeedStore, IUserStore, ISummaryCacheStore } from '@connpass-discord-bot/core';

export interface AgentContext {
  connpassClient: ConnpassClient;
  feedStore: IFeedStore;
  userStore: IUserStore;
  summaryCache?: ISummaryCacheStore;
}

/**
 * Discordメンション時のエージェントハンドラー
 */
export async function handleAgentMention(
  message: Message,
  agent: Agent,
  context: AgentContext
): Promise<void> {
  // メンションを除去したメッセージ内容を取得
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // スレッドで返信（既存スレッドまたは新規作成）
  let thread: ThreadChannel;

  if (message.channel.isThread()) {
    thread = message.channel as ThreadChannel;
  } else {
    // 新規スレッドを作成
    const textChannel = message.channel as TextChannel;
    thread = await textChannel.threads.create({
      name: `🤖 ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      startMessage: message,
      autoArchiveDuration: 60, // 1時間で自動アーカイブ
    });
  }

  // 入力中表示
  await thread.sendTyping();

  try {
    // RuntimeContextを構築
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('connpassClient', context.connpassClient);
    runtimeContext.set('feedStore', context.feedStore);
    runtimeContext.set('userStore', context.userStore);
    runtimeContext.set('summaryCache', context.summaryCache);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('channelId', message.channelId);
    runtimeContext.set('guildId', message.guildId);

    // メモリ用のIDを設定
    // resourceId: ユーザー毎のワーキングメモリ
    // threadId: 会話毎のメッセージ履歴
    const memoryOptions = {
      resource: message.author.id,
      thread: thread.id,
    };

    // エージェントを実行
    const response = await agent.generate(content, {
      runtimeContext,
      memory: memoryOptions,
    });

    // 2000文字制限を考慮して分割送信
    const chunks = splitMessage(response.text, 2000);
    for (const chunk of chunks) {
      await thread.send(chunk);
    }
  } catch (error) {
    console.error('[Agent] Error:', error);
    await thread.send('申し訳ありません。エラーが発生しました。');
  }
}

/**
 * ストリーミング対応のエージェントハンドラー
 */
export async function handleAgentMentionStream(
  message: Message,
  agent: Agent,
  context: AgentContext
): Promise<void> {
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  let thread: ThreadChannel;

  if (message.channel.isThread()) {
    thread = message.channel as ThreadChannel;
  } else {
    const textChannel = message.channel as TextChannel;
    thread = await textChannel.threads.create({
      name: `🤖 ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      startMessage: message,
      autoArchiveDuration: 60,
    });
  }

  await thread.sendTyping();

  try {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('connpassClient', context.connpassClient);
    runtimeContext.set('feedStore', context.feedStore);
    runtimeContext.set('userStore', context.userStore);
    runtimeContext.set('summaryCache', context.summaryCache);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('channelId', message.channelId);
    runtimeContext.set('guildId', message.guildId);

    const memoryOptions = {
      resource: message.author.id,
      thread: thread.id,
    };

    // ストリーミングで実行
    const stream = await agent.stream(content, {
      runtimeContext,
      memory: memoryOptions,
    });

    // テキストを収集
    let fullText = '';
    for await (const chunk of stream.textStream) {
      fullText += chunk;
    }

    // 分割送信
    const chunks = splitMessage(fullText, 2000);
    for (const chunk of chunks) {
      await thread.send(chunk);
    }
  } catch (error) {
    console.error('[Agent] Stream error:', error);
    await thread.send('申し訳ありません。エラーが発生しました。');
  }
}

/**
 * メッセージを指定文字数で分割
 */
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 最後の改行で分割を試みる
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // 改行がない場合はスペースで
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // スペースもない場合は強制分割
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
