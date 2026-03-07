import { Message, TextChannel, ThreadChannel, DMChannel, ActionRow, MessageActionRowComponent, ChannelType } from 'discord.js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { IFeedStore, IUserStore, ISummaryCacheStore, IChannelModelStore, IBanStore, IUserNotifySettingsStore } from '@connpass-discord-bot/core';
import { Logger, LogLevel, ActionType } from '@connpass-discord-bot/core';
import { setMessageCache, clearMessageCache } from './conversation-tools.js';
import { ProgressEmbed } from './progress-embed.js';
import { createConnpassAgent } from './connpass-agent.js';
import { getAIConfig, getModelConfigForChannel, hasApiKey } from '../ai/index.js';
import { isBannedUser } from '../security/permissions.js';

const logger = Logger.getInstance();

export interface AgentContext {
  connpassClient: ConnpassClient;
  feedStore: IFeedStore;
  userStore: IUserStore;
  summaryCache?: ISummaryCacheStore;
  channelModelStore: IChannelModelStore;
  banStore: IBanStore;
  notifySettingsStore?: IUserNotifySettingsStore;
}

/**
 * チャンネルまたは親チャンネルのIDを取得
 * スレッドの場合は親チャンネルの設定を使用
 */
function getChannelIdForConfig(message: Message): string {
  if (message.channel.isThread()) {
    const thread = message.channel as ThreadChannel;
    return thread.parentId ?? message.channelId;
  }
  return message.channelId;
}

/**
 * Discordメンション時のエージェントハンドラー
 */
export async function handleAgentMention(
  message: Message,
  context: AgentContext
): Promise<void> {
  if (await isBannedUser(context.banStore, message.author.id)) {
    await message.reply('⛔ あなたはBANされているため、AI機能は使用できません。');
    return;
  }
  // チャンネル設定を取得（スレッドの場合は親チャンネル）
  const configChannelId = getChannelIdForConfig(message);
  const channelModelConfig = await context.channelModelStore.get(configChannelId);
  
  // 使用するモデルのAPIキーが存在するかチェック
  const aiConfig = getAIConfig();
  const modelConfig = getModelConfigForChannel(aiConfig, 'agent', channelModelConfig);
  if (!hasApiKey(modelConfig.provider)) {
    await message.reply(`❌ ${modelConfig.provider} のAPIキーが設定されていません。環境変数を確認してください。`);
    return;
  }

  // AIエージェント開始のログ
  logger.logAction({
    level: LogLevel.INFO,
    actionType: ActionType.AI_AGENT_START,
    component: 'Agent',
    message: `Agent started with model ${modelConfig.provider}/${modelConfig.model}`,
    userId: message.author.id,
    guildId: message.guildId ?? undefined,
    channelId: configChannelId,
    metadata: {
      provider: modelConfig.provider,
      model: modelConfig.model,
    },
  });

  const agent = createConnpassAgent(channelModelConfig);
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // 返信先チャンネル（スレッドまたはDM）
  let targetChannel: ThreadChannel | DMChannel;
  let contextInfo = '';

  if (message.channel.type === ChannelType.DM) {
    targetChannel = message.channel as DMChannel;
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
      logger.warn('Agent', 'Failed to fetch starter message', { error: String(e) });
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
    runtimeContext.set('notifySettingsStore', context.notifySettingsStore);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('channelId', configChannelId);
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
    logger.logAction({
      level: LogLevel.ERROR,
      actionType: ActionType.AI_ERROR,
      component: 'Agent',
      message: 'Agent execution failed',
      userId: message.author.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
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
  context: AgentContext
): Promise<void> {
  if (await isBannedUser(context.banStore, message.author.id)) {
    await message.reply('⛔ あなたはBANされているため、AI機能は使用できません。');
    return;
  }
  // チャンネル設定を取得（スレッドの場合は親チャンネル）
  const configChannelId = getChannelIdForConfig(message);
  const channelModelConfig = await context.channelModelStore.get(configChannelId);
  
  // 使用するモデルのAPIキーが存在するかチェック
  const aiConfig = getAIConfig();
  const modelConfig = getModelConfigForChannel(aiConfig, 'agent', channelModelConfig);
  if (!hasApiKey(modelConfig.provider)) {
    await message.reply(`❌ ${modelConfig.provider} のAPIキーが設定されていません。環境変数を確認してください。`);
    return;
  }

  logger.logAction({
    level: LogLevel.INFO,
    actionType: ActionType.AI_AGENT_START,
    component: 'Agent',
    message: `Agent (stream) started with model ${modelConfig.provider}/${modelConfig.model}`,
    userId: message.author.id,
    guildId: message.guildId ?? undefined,
    channelId: configChannelId,
    metadata: {
      provider: modelConfig.provider,
      model: modelConfig.model,
      mode: 'stream',
    },
  });

  const agent = createConnpassAgent(channelModelConfig);
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // 返信先チャンネル（スレッドまたはDM）
  let targetChannel: ThreadChannel | DMChannel;
  let contextInfo = '';

  if (message.channel.type === ChannelType.DM) {
    targetChannel = message.channel as DMChannel;
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
      logger.warn('Agent', 'Failed to fetch starter message', { error: String(e) });
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
    runtimeContext.set('notifySettingsStore', context.notifySettingsStore);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('channelId', configChannelId);
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
    logger.logAction({
      level: LogLevel.ERROR,
      actionType: ActionType.AI_ERROR,
      component: 'Agent',
      message: 'Agent stream execution failed',
      userId: message.author.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        mode: 'stream',
      },
    });
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
    case 'manageNotify':
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
  context: AgentContext
): Promise<void> {
  if (await isBannedUser(context.banStore, message.author.id)) {
    await message.reply('⛔ あなたはBANされているため、AI機能は使用できません。');
    return;
  }
  // チャンネル設定を取得（スレッドの場合は親チャンネル）
  const configChannelId = getChannelIdForConfig(message);
  const channelModelConfig = await context.channelModelStore.get(configChannelId);
  
  // 使用するモデルのAPIキーが存在するかチェック
  const aiConfig = getAIConfig();
  const modelConfig = getModelConfigForChannel(aiConfig, 'agent', channelModelConfig);
  if (!hasApiKey(modelConfig.provider)) {
    await message.reply(`❌ ${modelConfig.provider} のAPIキーが設定されていません。環境変数を確認してください。`);
    return;
  }

  const startTime = Date.now();
  logger.logAction({
    level: LogLevel.INFO,
    actionType: ActionType.AI_AGENT_START,
    component: 'Agent',
    message: `Agent (progress) started with model ${modelConfig.provider}/${modelConfig.model}`,
    userId: message.author.id,
    guildId: message.guildId ?? undefined,
    channelId: configChannelId,
    metadata: {
      provider: modelConfig.provider,
      model: modelConfig.model,
      mode: 'progress',
      rawContent: message.content,
    },
  });

  const agent = createConnpassAgent(channelModelConfig);
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  logger.debug('Agent', `Processed content: "${content}"`, { contentLength: content.length });

  if (!content) {
    await message.reply('何かお聞きしたいことはありますか？');
    return;
  }

  // 返信先チャンネル（スレッドまたはDM）
  let targetChannel: ThreadChannel | DMChannel;
  let contextInfo = '';

  if (message.channel.type === ChannelType.DM) {
    targetChannel = message.channel as DMChannel;
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
      logger.warn('Agent', 'Failed to fetch starter message', { error: String(e) });
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

  // メッセージ履歴を取得してキャッシュ＆直近コンテキスト構築（既存スレッド/DMの場合）
  if (message.channel.isThread() || message.channel.type === ChannelType.DM) {
    try {
      const channel = targetChannel;
      // 現在のメッセージも含めて取得（順序保証のため）
      const messagesCollection = await channel.messages.fetch({ limit: 20 });
      const messages = Array.from(messagesCollection.values());

      // ツール用にキャッシュ
      setMessageCache(channel.id, messages);

      // 直近3件（現在のメッセージ以外）をプロンプトに含める
      const recentHistory = messages
        .filter((m) => m.id !== message.id)
        .slice(0, 7)
        .reverse();

      if (recentHistory.length > 0) {
        contextInfo += `\n\n【直近の会話履歴】\n`;
        recentHistory.forEach((m) => {
          let content = m.content.replace(/<@!?\d+>/g, '').trim();
          // Embedがある場合
          if (!content && m.embeds.length > 0) {
             if (m.embeds[0].title) content = `[Embed: ${m.embeds[0].title}]`;
             else if (m.embeds[0].description) content = `[Embed: ${m.embeds[0].description.slice(0, 20)}...]`;
          }
          if (!content && m.attachments.size > 0) content = '[画像/添付ファイル]';
          if (!content) content = '[コンテンツなし]';

          const author = m.author.bot ? 'Assistant' : (m.author.displayName || m.author.username);
          contextInfo += `- ${author}: ${content}\n`;
        });
        contextInfo += `(これより前の履歴が必要な場合は、getConversationSummaryツールを使用してください)\n`;
      }
    } catch (e) {
      logger.warn('Agent', 'Failed to fetch history', { error: String(e) });
    }
  }

  const progress = new ProgressEmbed(targetChannel);
  progress.setModelInfo(modelConfig.provider, modelConfig.model);
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
    runtimeContext.set('notifySettingsStore', context.notifySettingsStore);
    runtimeContext.set('discordUserId', message.author.id);
    runtimeContext.set('channelId', configChannelId);
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

    const duration = Date.now() - startTime;
    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.AI_AGENT_END,
      component: 'Agent',
      message: `Agent (progress) completed successfully`,
      userId: message.author.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      metadata: {
        provider: modelConfig.provider,
        model: modelConfig.model,
        durationMs: duration,
        responseLength: fullText.length,
      },
    });

    // 最終結果を送信
    if (fullText.trim()) {
      const chunks = splitMessage(fullText, 2000);
      for (const chunk of chunks) {
        await targetChannel.send(chunk);
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logAction({
      level: LogLevel.ERROR,
      actionType: ActionType.AI_ERROR,
      component: 'Agent',
      message: 'Agent (progress) execution failed',
      userId: message.author.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
        mode: 'progress',
      },
    });
    await progress.error('処理中にエラーが発生しました');
    await targetChannel.send('申し訳ありません。エラーが発生しました。');
  } finally {
    clearInterval(typingInterval);
    clearMessageCache();
  }
}
