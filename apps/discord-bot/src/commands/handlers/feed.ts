import type { ChatInputCommandInteraction } from 'discord.js';
import type {
  FeedConfig,
  IFeedStore,
  IBanStore,
  FeedSetOptions,
  CommandContext,
} from '@connpass-discord-bot/core';
import {
  Logger,
  LogLevel,
  ActionType,
  handleFeedSetCore,
  handleFeedStatusCore,
  handleFeedRemoveCore,
} from '@connpass-discord-bot/core';
import type { Scheduler, FeedExecutor } from '@connpass-discord-bot/feed-worker';
import { getPrefectureName } from '../../data/prefectures.js';
import { isBannedUser } from '../../security/permissions.js';

const logger = Logger.getInstance();

/**
 * FeedConfigを比較可能なオブジェクトに変換（ログ用）
 */
function feedConfigToLogObject(config: FeedConfig): Record<string, unknown> {
  return {
    schedule: config.schedule,
    rangeDays: config.rangeDays,
    keywordsAnd: config.keywordsAnd,
    keywordsOr: config.keywordsOr,
    location: config.location,
    hashtag: config.hashtag,
    ownerNickname: config.ownerNickname,
    order: config.order,
    minParticipantCount: config.minParticipantCount,
    minLimit: config.minLimit,
    useAi: config.useAi,
  };
}

/**
 * Discordインタラクションからオプションを抽出
 */
function extractFeedSetOptions(interaction: ChatInputCommandInteraction): FeedSetOptions {
  return {
    schedule: interaction.options.getString('schedule', true),
    customSchedule: interaction.options.getString('custom_schedule') ?? undefined,
    keywordsAnd: interaction.options.getString('keywords_and') ?? undefined,
    keywordsOr: interaction.options.getString('keywords_or') ?? undefined,
    rangeDays: interaction.options.getInteger('range_days') ?? undefined,
    location: interaction.options.getString('location') ?? undefined,
    hashtag: interaction.options.getString('hashtag') ?? undefined,
    ownerNickname: interaction.options.getString('owner_nickname') ?? undefined,
    order: (interaction.options.getString('order') as FeedConfig['order']) ?? undefined,
    minParticipants: interaction.options.getInteger('min_participants') ?? undefined,
    minLimit: interaction.options.getInteger('min_limit') ?? undefined,
    useAi: interaction.options.getBoolean('use_ai') ?? undefined,
  };
}

/**
 * DiscordインタラクションからCommandContextを生成
 */
function createCommandContext(interaction: ChatInputCommandInteraction): CommandContext {
  return {
    channelId: interaction.channelId,
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
  };
}

/**
 * /connpass feed set ハンドラー（Discordアダプター）
 */
export async function handleFeedSet(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore,
  scheduler: Scheduler,
  banStore: IBanStore
): Promise<void> {
  // Discord固有: BANチェック
  if (await isBannedUser(banStore, interaction.user.id)) {
    await interaction.reply({
      content: '⛔ あなたはBANされているため、Feedの変更はできません。',
      ephemeral: true,
    });
    return;
  }

  const ctx = createCommandContext(interaction);
  const options = extractFeedSetOptions(interaction);

  // 既存フィードを取得（ログ用）
  const existingFeed = await store.get(ctx.channelId);

  // コアロジック呼び出し
  const response = await handleFeedSetCore(ctx, options, store, scheduler, getPrefectureName);

  // Discord固有: ログ記録
  if (!response.ephemeral) {
    const savedFeed = await store.get(ctx.channelId);
    if (savedFeed) {
      logger.logAction({
        level: LogLevel.INFO,
        actionType: existingFeed ? ActionType.SCHEDULE_UPDATE : ActionType.SCHEDULE_CREATE,
        component: 'Feed',
        message: existingFeed ? 'Feed schedule updated' : 'Feed schedule created',
        userId: interaction.user.id,
        guildId: interaction.guildId ?? undefined,
        channelId: ctx.channelId,
        beforeState: existingFeed ? feedConfigToLogObject(existingFeed.config) : undefined,
        afterState: feedConfigToLogObject(savedFeed.config),
      });
    }
  }

  // Discord返信
  await interaction.reply({
    content: response.content,
    ephemeral: response.ephemeral ?? false,
  });
}

/**
 * /connpass feed status ハンドラー（Discordアダプター）
 */
export async function handleFeedStatus(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore
): Promise<void> {
  const ctx = createCommandContext(interaction);

  // コアロジック呼び出し
  const response = await handleFeedStatusCore(ctx, store, getPrefectureName);

  // Discord返信
  await interaction.reply({
    content: response.content,
    ephemeral: response.ephemeral ?? false,
  });
}

/**
 * /connpass feed remove ハンドラー（Discordアダプター）
 */
export async function handleFeedRemove(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore,
  scheduler: Scheduler,
  banStore: IBanStore
): Promise<void> {
  // Discord固有: BANチェック
  if (await isBannedUser(banStore, interaction.user.id)) {
    await interaction.reply({
      content: '⛔ あなたはBANされているため、Feedの変更はできません。',
      ephemeral: true,
    });
    return;
  }

  const ctx = createCommandContext(interaction);

  // 既存フィードを取得（ログ用）
  const existingFeed = await store.get(ctx.channelId);

  // コアロジック呼び出し
  const response = await handleFeedRemoveCore(ctx, store, scheduler);

  // Discord固有: ログ記録
  if (!response.ephemeral && existingFeed) {
    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULE_DELETE,
      component: 'Feed',
      message: 'Feed schedule deleted',
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      channelId: ctx.channelId,
      beforeState: feedConfigToLogObject(existingFeed.config),
      afterState: undefined,
    });
  }

  // Discord返信
  await interaction.reply({
    content: response.content,
    ephemeral: response.ephemeral ?? false,
  });
}

/**
 * /connpass feed run ハンドラー（Discord固有 - コア化不要）
 * FeedExecutorはDiscord sinkに依存するため、そのまま残す
 */
export async function handleFeedRun(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore,
  executor: FeedExecutor,
  banStore: IBanStore
): Promise<void> {
  // Discord固有: BANチェック
  if (await isBannedUser(banStore, interaction.user.id)) {
    await interaction.reply({
      content: '⛔ あなたはBANされているため、Feedの変更はできません。',
      ephemeral: true,
    });
    return;
  }

  const channelId = interaction.channelId;
  const feed = await store.get(channelId);

  if (!feed) {
    await interaction.reply({
      content: 'このチャンネルにはフィードが設定されていません。\n`/connpass feed set` で設定してください。',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const result = await executor.execute(channelId);

    if (result.error) {
      await interaction.editReply({
        content: `フィード実行エラー: ${result.error}`,
      });
      return;
    }

    await interaction.editReply({
      content: `フィードを実行しました。\n合計 ${result.total} 件のイベントから、${result.newCount} 件の新着を検出しました。`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply({
      content: `フィード実行エラー: ${message}`,
    });
  }
}
