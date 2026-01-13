import { Message, TextChannel, ThreadChannel, ActionRow, MessageActionRowComponent, ChannelType, TextBasedChannel } from 'discord.js';
import { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import {
  getAccessControlConfigFromEnv,
  isAccessAllowed,
  type IFeedStore,
  type IUserStore,
  type ISummaryCacheStore,
} from '@connpass-discord-bot/core';
import { ProgressEmbed } from './progress-embed.js';

export interface AgentContext {
  connpassClient: ConnpassClient;
  feedStore: IFeedStore;
  userStore: IUserStore;
  summaryCache?: ISummaryCacheStore;
}

const aiAgentAccessConfig = getAccessControlConfigFromEnv('AI_AGENT');

function getRoleIdsFromMessage(message: Message): string[] {
  if (!message.member) return [];
  return Array.from(message.member.roles.cache.keys());
}

async function ensureAgentAccess(message: Message): Promise<boolean> {
  const roleIds = getRoleIdsFromMessage(message);
  const allowed = isAccessAllowed(message.author.id, roleIds, aiAgentAccessConfig);
  if (!allowed) {
    await message.reply('このAIエージェントを利用する権限がありません。');
  }
  return allowed;
}

/**
 * Discordメンション時のエージェントハンドラー
 */
export async function handleAgentMention(
  message: Message,
  agent: Agent,
  context: AgentContext
): Promise<void> {
  if (!(await ensureAgentAccess(message))) {
    return;
  }
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // 返信先チャンネル（スレッドまたはDM）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targetChannel: any;
  let contextInfo = '';

  if (message.channel.type === ChannelType.DM) {
    targetChannel = message.channel as TextBasedChannel;
  } else if (message.channel.isThread()) {
    targetChannel = message.channel as ThreadChannel;
    
    // スレッドの開始メッセージ（イベント詳細）を取得してコンテキストにする
    try {
      const thread = targetChannel as ThreadChannel;
      const starterMsg = await thread.fetchStarterMessage();
      if (starterMsg) {
        const embed = starterMsg.embeds[0];
        if (embed) {
          contextInfo += `\n\n【現在のトピック情報】\n`;
          if (embed.title) contextInfo += `イベント名: ${embed.title}\n`;
          if (embed.url) contextInfo += `URL: ${embed.url}\n`;
          
          // ボタンからイベントIDを取得
          const row = starterMsg.components[0] as ActionRow<MessageActionRowComponent> | undefined;
          if (row && 'components' in row) {
            const button = row.components.find((c: MessageActionRowComponent) => 
              'customId' in c && c.customId?.startsWith('ev:')
            );
            if (button && 'customId' in button && button.customId) {
              const parts = button.customId.split(':');
              if (parts.length >= 3) {
                contextInfo += `イベントID: ${parts[2]}\n`;
              }
            }
          }
          contextInfo += `(ユーザーはこのイベントについて質問しています)\n`;
        }
      }
    } catch (e) {
      console.warn('[Agent] Failed to fetch starter message:', e);
    }

  } else {
    // 新規スレッドを作成
    const textChannel = message.channel as TextChannel;
    targetChannel = await textChannel.threads.create({
      name: `🤖 ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      startMessage: message,
      autoArchiveDuration: 60, // 1時間で自動アーカイブ
    });
  }

  // 入力中表示
  // 入力中表示（継続的）
  await targetChannel.sendTyping();
  const typingInterval = setInterval(() => {
    targetChannel.sendTyping().catch(() => {});
  }, 5000);

  try {
    // RuntimeContextを構築
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('connpassClient', context.connpassClient);
    runtimeContext.set('feedStore', context.feedStore);
    runtimeContext.set('userStore', context.userStore);
    runtimeContext.set('summaryCache', context.summaryCache);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('discordRoleIds', getRoleIdsFromMessage(message));
    runtimeContext.set('channelId', message.channelId);
    runtimeContext.set('guildId', message.guildId);
    if (contextInfo) {
      runtimeContext.set('eventContext', contextInfo);
    }

    // メモリ用のIDを設定
    // resourceId: ユーザー毎のワーキングメモリ
    // threadId: 会話毎のメッセージ履歴
    const memoryOptions = {
      resource: message.author.id,
      thread: targetChannel.id,
    };

    // エージェントを実行
    const stream = await agent.stream(content, {
      runtimeContext,
      memory: memoryOptions,
    });

    let responseText = '';
    for await (const chunk of stream.textStream) {
      responseText += chunk;
    }

    // 2000文字制限を考慮して分割送信
    const chunks = splitMessage(responseText, 2000);
    for (const chunk of chunks) {
      await targetChannel.send(chunk);
    }
  } catch (error) {
    console.error('[Agent] Error:', error);
    await targetChannel.send('申し訳ありません。エラーが発生しました。');
  } finally {
    clearInterval(typingInterval);
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
  if (!(await ensureAgentAccess(message))) {
    return;
  }
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // 返信先チャンネル（スレッドまたはDM）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targetChannel: any;
  let contextInfo = '';

  if (message.channel.type === ChannelType.DM) {
    targetChannel = message.channel;
  } else if (message.channel.isThread()) {
    targetChannel = message.channel as ThreadChannel;

    // スレッドの開始メッセージからコンテキストを取得
    try {
      const thread = targetChannel as ThreadChannel;
      const starterMsg = await thread.fetchStarterMessage();
      if (starterMsg) {
        const embed = starterMsg.embeds[0];
        if (embed) {
          contextInfo += `\n\n【現在のトピック情報】\n`;
          if (embed.title) contextInfo += `イベント名: ${embed.title}\n`;
          if (embed.url) contextInfo += `URL: ${embed.url}\n`;
          
          const row = starterMsg.components[0] as ActionRow<MessageActionRowComponent> | undefined;
          if (row && 'components' in row) {
            const button = row.components.find((c: MessageActionRowComponent) => 
              'customId' in c && c.customId?.startsWith('ev:')
            );
            if (button && 'customId' in button && button.customId) {
              const parts = button.customId.split(':');
              if (parts.length >= 3) {
                contextInfo += `イベントID: ${parts[2]}\n`;
              }
            }
          }
          contextInfo += `(ユーザーはこのイベントについて質問しています)\n`;
        }
      }
    } catch (e) {
      console.warn('[Agent] Failed to fetch starter message:', e);
    }
  } else {
    const textChannel = message.channel as TextChannel;
    targetChannel = await textChannel.threads.create({
      name: `🤖 ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      startMessage: message,
      autoArchiveDuration: 60,
    });
  }

  // 入力中表示（継続的）
  await targetChannel.sendTyping();
  const typingInterval = setInterval(() => {
    targetChannel.sendTyping().catch(() => {});
  }, 5000);

  try {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('connpassClient', context.connpassClient);
    runtimeContext.set('feedStore', context.feedStore);
    runtimeContext.set('userStore', context.userStore);
    runtimeContext.set('summaryCache', context.summaryCache);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('discordRoleIds', getRoleIdsFromMessage(message));
    runtimeContext.set('channelId', message.channelId);
    runtimeContext.set('guildId', message.guildId);
    if (contextInfo) {
      runtimeContext.set('eventContext', contextInfo);
    }

    const memoryOptions = {
      resource: message.author.id,
      thread: targetChannel.id,
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
      await targetChannel.send(chunk);
    }
  } catch (error) {
    console.error('[Agent] Stream error:', error);
    await targetChannel.send('申し訳ありません。エラーが発生しました。');
  } finally {
    clearInterval(typingInterval);
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

/**
 * ツール結果から要約を生成
 */
function summarizeToolResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return '';

  const r = result as Record<string, unknown>;

  switch (toolName) {
    case 'searchEvents':
      if (Array.isArray(r.events)) {
        return `${r.events.length}件のイベント`;
      }
      break;
    case 'getEventDetails':
      if (r.title) {
        return `"${String(r.title).slice(0, 30)}..."`;
      }
      break;
    case 'getUserSchedule':
      if (Array.isArray(r.events)) {
        return `${r.events.length}件の予定`;
      }
      break;
    case 'manageFeed':
      if (r.message) {
        return String(r.message).slice(0, 50);
      }
      break;
  }

  return '';
}

/**
 * 進捗表示付きエージェントハンドラー
 */
export async function handleAgentMentionWithProgress(
  message: Message,
  agent: Agent,
  context: AgentContext
): Promise<void> {
  if (!(await ensureAgentAccess(message))) {
    return;
  }
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // 返信先チャンネル（スレッドまたはDM）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targetChannel: any;
  let contextInfo = '';

  if (message.channel.type === ChannelType.DM) {
    targetChannel = message.channel as TextBasedChannel;
  } else if (message.channel.isThread()) {
    targetChannel = message.channel as ThreadChannel;

    // スレッドの開始メッセージ（イベント詳細）を取得してコンテキストにする
    try {
      const thread = targetChannel as ThreadChannel;
      const starterMsg = await thread.fetchStarterMessage();
      if (starterMsg) {
        const embed = starterMsg.embeds[0];
        if (embed) {
          contextInfo += `\n\n【現在のトピック情報】\n`;
          if (embed.title) contextInfo += `イベント名: ${embed.title}\n`;
          if (embed.url) contextInfo += `URL: ${embed.url}\n`;

          const row = starterMsg.components[0] as ActionRow<MessageActionRowComponent> | undefined;
          if (row && 'components' in row) {
            const button = row.components.find((c: MessageActionRowComponent) =>
              'customId' in c && c.customId?.startsWith('ev:')
            );
            if (button && 'customId' in button && button.customId) {
              const parts = button.customId.split(':');
              if (parts.length >= 3) {
                contextInfo += `イベントID: ${parts[2]}\n`;
              }
            }
          }
          contextInfo += `(ユーザーはこのイベントについて質問しています)\n`;
        }
      }
    } catch (e) {
      console.warn('[Agent] Failed to fetch starter message:', e);
    }
  } else {
    // 新規スレッドを作成
    const textChannel = message.channel as TextChannel;
    targetChannel = await textChannel.threads.create({
      name: `🤖 ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      startMessage: message,
      autoArchiveDuration: 60,
    });
  }

  const progress = new ProgressEmbed(targetChannel);
  await progress.start(content);

  // 入力中表示（継続的）
  await targetChannel.sendTyping();
  const typingInterval = setInterval(() => {
    targetChannel.sendTyping().catch(() => {});
  }, 5000);

  try {
    // RuntimeContextを構築
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('connpassClient', context.connpassClient);
    runtimeContext.set('feedStore', context.feedStore);
    runtimeContext.set('userStore', context.userStore);
    runtimeContext.set('summaryCache', context.summaryCache);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('discordRoleIds', getRoleIdsFromMessage(message));
    runtimeContext.set('channelId', message.channelId);
    runtimeContext.set('guildId', message.guildId);
    if (contextInfo) {
      runtimeContext.set('eventContext', contextInfo);
    }
    runtimeContext.set('progress', progress);

    const memoryOptions = {
      resource: message.author.id,
      thread: targetChannel.id,
    };

    // AI SDK v5モデル対応のstreamを使用
    const stream = await agent.stream(content, {
      runtimeContext,
      memory: memoryOptions,
    });

    let fullText = '';

    for await (const chunk of stream.textStream) {
      fullText += chunk;
    }

    // 進捗を完了状態に
    await progress.complete();

    // 最終結果を送信
    if (fullText.trim()) {
      const chunks = splitMessage(fullText, 2000);
      for (const chunk of chunks) {
        await targetChannel.send(chunk);
      }
    }
  } catch (error) {
    console.error('[Agent] Error:', error);
    await progress.error('処理中にエラーが発生しました');
    await targetChannel.send('申し訳ありません。エラーが発生しました。');
  } finally {
    clearInterval(typingInterval);
  }
}
