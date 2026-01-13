import type { ChatInputCommandInteraction } from 'discord.js';
import type { Feed, FeedConfig, IFeedStore } from '@connpass-discord-bot/core';
import {
  DEFAULTS,
  getAccessControlConfigFromEnv,
  isAccessAllowed,
} from '@connpass-discord-bot/core';
import type { Scheduler, FeedExecutor } from '@connpass-discord-bot/feed-worker';
import { CronExpressionParser } from 'cron-parser';
import { getPrefectureName } from '../../data/prefectures.js';

/**
 * キーワード文字列をパース（カンマ/スペース区切り）
 */
function parseKeywords(input: string | null): string[] | undefined {
  if (!input) return undefined;
  return input
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * cron式を分かりやすい日本語に変換
 */
const SCHEDULE_LABELS: Record<string, string> = {
  '0 9 * * *': '毎日 9:00',
  '0 12 * * *': '毎日 12:00',
  '0 18 * * *': '毎日 18:00',
  '0 9 * * 1-5': '平日 9:00',
  '0 9 * * 1': '毎週月曜 9:00',
  '0 18 * * 5': '毎週金曜 18:00',
};

const feedAccessConfig = getAccessControlConfigFromEnv('FEED');

function getRoleIdsFromInteraction(interaction: ChatInputCommandInteraction): string[] {
  if (!interaction.inGuild()) return [];
  const member = interaction.member;
  if (!member) return [];
  const roles = (member as { roles?: { cache?: Map<string, { id: string }> } | string[] })
    .roles;
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  if ('cache' in roles && roles.cache) {
    return Array.from(roles.cache.keys());
  }
  return [];
}

async function ensureFeedAccess(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const roleIds = getRoleIdsFromInteraction(interaction);
  const allowed = isAccessAllowed(interaction.user.id, roleIds, feedAccessConfig);
  if (!allowed) {
    await interaction.reply({
      content: 'このコマンドを実行する権限がありません。',
      ephemeral: true,
    });
  }
  return allowed;
}

function formatSchedule(schedule: string): string {
  return SCHEDULE_LABELS[schedule] ?? schedule;
}

/**
 * 日時をJSTでフォーマット
 */
function formatDateJST(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function formatSizeFilter(minParticipants?: number, minLimit?: number): string | null {
  if (minParticipants === undefined && minLimit === undefined) {
    return null;
  }

  if (minParticipants !== undefined && minLimit !== undefined) {
    return `**規模フィルタ**: 参加者 ${minParticipants}人以上 または 募集人数 ${minLimit}人以上`;
  }

  if (minParticipants !== undefined) {
    return `**規模フィルタ**: 参加者 ${minParticipants}人以上`;
  }

  return `**規模フィルタ**: 募集人数 ${minLimit}人以上`;
}

/**
 * cron式の妥当性を検証
 */
function validateCron(schedule: string): { valid: boolean; error?: string } {
  try {
    CronExpressionParser.parse(schedule);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid cron expression',
    };
  }
}

/**
 * /connpass feed set ハンドラー
 */
export async function handleFeedSet(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore,
  scheduler: Scheduler
): Promise<void> {
  if (!(await ensureFeedAccess(interaction))) {
    return;
  }
  const channelId = interaction.channelId;

  // オプション取得
  const scheduleOption = interaction.options.getString('schedule', true);
  const customSchedule = interaction.options.getString('custom_schedule');

  // カスタム選択時は custom_schedule を使用
  let schedule: string;
  if (scheduleOption === 'custom') {
    if (!customSchedule) {
      await interaction.reply({
        content: '「カスタム」を選択した場合は `custom_schedule` にcron式を入力してください。\n例: `0 9 * * 1` = 毎週月曜9時',
        ephemeral: true,
      });
      return;
    }
    schedule = customSchedule;
  } else {
    schedule = scheduleOption;
  }
  const keywordsAnd = parseKeywords(interaction.options.getString('keywords_and'));
  const keywordsOr = parseKeywords(interaction.options.getString('keywords_or'));
  const rangeDays = interaction.options.getInteger('range_days') ?? DEFAULTS.RANGE_DAYS;
  const location = parseKeywords(interaction.options.getString('location'));
  const hashtag = interaction.options.getString('hashtag') ?? undefined;
  const ownerNickname = interaction.options.getString('owner_nickname') ?? undefined;
  const order =
    (interaction.options.getString('order') as FeedConfig['order']) ?? DEFAULTS.ORDER;
  const minParticipantCount = interaction.options.getInteger('min_participants') ?? undefined;
  const minLimit = interaction.options.getInteger('min_limit') ?? undefined;
  const useAi = interaction.options.getBoolean('use_ai') ?? false;

  // cron式検証
  const cronValidation = validateCron(schedule);
  if (!cronValidation.valid) {
    await interaction.reply({
      content: `無効なcron式です: ${cronValidation.error}`,
      ephemeral: true,
    });
    return;
  }

  // 既存フィードを取得または新規作成
  const existingFeed = await store.get(channelId);

  const feed: Feed = {
    config: {
      id: channelId,
      channelId,
      schedule,
      rangeDays,
      keywordsAnd,
      keywordsOr,
      location,
      hashtag,
      ownerNickname,
      order,
      minParticipantCount,
      minLimit,
      useAi,
    },
    state: existingFeed?.state ?? { sentEvents: {} },
  };

  await store.save(feed);
  await scheduler.scheduleFeed(channelId);

  // 次回実行日時を取得
  const savedFeed = await store.get(channelId);
  const nextRunAt = savedFeed?.state.nextRunAt;

  // 設定内容を表示
  const settings = [
    `**スケジュール**: ${formatSchedule(schedule)}`,
    `**検索範囲**: ${rangeDays}日`,
    keywordsAnd?.length ? `**ANDキーワード**: ${keywordsAnd.join(', ')}` : null,
    keywordsOr?.length ? `**ORキーワード**: ${keywordsOr.join(', ')}` : null,
    location?.length ? `**都道府県**: ${location.map(getPrefectureName).join(', ')}` : null,
    hashtag ? `**ハッシュタグ**: #${hashtag}` : null,
    ownerNickname ? `**主催者**: ${ownerNickname}` : null,
    `**ソート順**: ${order}`,
    formatSizeFilter(minParticipantCount, minLimit),
    '',
    `**次回実行**: ${nextRunAt ? formatDateJST(nextRunAt) : '未設定'}`,
  ]
    .filter(Boolean)
    .join('\n');

  await interaction.reply({
    content: `フィード設定を${existingFeed ? '更新' : '追加'}しました。\n\n${settings}`,
    ephemeral: false,
  });
}

/**
 * /connpass feed status ハンドラー
 */
export async function handleFeedStatus(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore
): Promise<void> {
  if (!(await ensureFeedAccess(interaction))) {
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

  const { config, state } = feed;

  const settings = [
    `**スケジュール**: ${formatSchedule(config.schedule)}`,
    `**検索範囲**: ${config.rangeDays}日`,
    config.keywordsAnd?.length ? `**ANDキーワード**: ${config.keywordsAnd.join(', ')}` : null,
    config.keywordsOr?.length ? `**ORキーワード**: ${config.keywordsOr.join(', ')}` : null,
    config.location?.length ? `**都道府県**: ${config.location.map(getPrefectureName).join(', ')}` : null,
    config.hashtag ? `**ハッシュタグ**: #${config.hashtag}` : null,
    config.ownerNickname ? `**主催者**: ${config.ownerNickname}` : null,
    `**ソート順**: ${config.order ?? DEFAULTS.ORDER}`,
    formatSizeFilter(config.minParticipantCount, config.minLimit),
    '',
    `**最終実行**: ${state.lastRunAt ? formatDateJST(state.lastRunAt) : '未実行'}`,
    `**次回実行**: ${state.nextRunAt ? formatDateJST(state.nextRunAt) : '未設定'}`,
    `**送信済みイベント数**: ${Object.keys(state.sentEvents).length}`,
  ]
    .filter((s) => s !== null)
    .join('\n');

  await interaction.reply({
    content: `**このチャンネルのフィード設定**\n\n${settings}`,
    ephemeral: false,
  });
}

/**
 * /connpass feed remove ハンドラー
 */
export async function handleFeedRemove(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore,
  scheduler: Scheduler
): Promise<void> {
  if (!(await ensureFeedAccess(interaction))) {
    return;
  }
  const channelId = interaction.channelId;
  const feed = await store.get(channelId);

  if (!feed) {
    await interaction.reply({
      content: 'このチャンネルにはフィードが設定されていません。',
      ephemeral: true,
    });
    return;
  }

  await scheduler.unscheduleFeed(channelId);
  await store.delete(channelId);

  await interaction.reply({
    content: 'フィード設定を削除しました。',
    ephemeral: false,
  });
}

/**
 * /connpass feed run ハンドラー
 */
export async function handleFeedRun(
  interaction: ChatInputCommandInteraction,
  store: IFeedStore,
  executor: FeedExecutor
): Promise<void> {
  if (!(await ensureFeedAccess(interaction))) {
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
