/**
 * Discord非依存のFeedコマンドコアロジック
 */

import { CronExpressionParser } from 'cron-parser';
import type { IFeedStore } from '../repositories/IFeedStore.js';
import type { Feed, FeedConfig } from '../domain/types.js';
import { DEFAULTS } from '../domain/types.js';
import type { CommandContext, CommandResponse, FeedSetOptions } from './types.js';
import { SCHEDULE_LABELS } from './types.js';

/**
 * スケジューラーインターフェース（feed-workerから注入）
 */
export interface IScheduler {
  scheduleFeed(channelId: string): Promise<void>;
  unscheduleFeed(channelId: string): Promise<void>;
}

/**
 * キーワード文字列をパース（カンマ/スペース区切り）
 */
function parseKeywords(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  return input
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * cron式を分かりやすい日本語に変換
 */
function formatSchedule(schedule: string): string {
  return SCHEDULE_LABELS[schedule] ?? schedule;
}

/**
 * 日時をJSTでフォーマット
 */
function formatDateJST(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

/**
 * 規模フィルタをフォーマット
 */
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
 * 都道府県コードを名前に変換するヘルパー
 * CLI/Discord両方から使えるようにオプショナル
 */
export type PrefectureNameResolver = (code: string) => string;

const defaultPrefectureResolver: PrefectureNameResolver = (code) => code;

/**
 * /connpass feed set コアハンドラー
 */
export async function handleFeedSetCore(
  ctx: CommandContext,
  options: FeedSetOptions,
  store: IFeedStore,
  scheduler: IScheduler,
  getPrefectureName: PrefectureNameResolver = defaultPrefectureResolver
): Promise<CommandResponse> {
  const { channelId } = ctx;

  // スケジュール決定
  let schedule: string;
  if (options.schedule === 'custom') {
    if (!options.customSchedule) {
      return {
        content: '「カスタム」を選択した場合は `custom_schedule` にcron式を入力してください。\n例: `0 9 * * 1` = 毎週月曜9時',
        ephemeral: true,
      };
    }
    schedule = options.customSchedule;
  } else {
    schedule = options.schedule;
  }

  // cron式検証
  const cronValidation = validateCron(schedule);
  if (!cronValidation.valid) {
    return {
      content: `無効なcron式です: ${cronValidation.error}`,
      ephemeral: true,
    };
  }

  // オプションパース
  const keywordsAnd = parseKeywords(options.keywordsAnd);
  const keywordsOr = parseKeywords(options.keywordsOr);
  const rangeDays = options.rangeDays ?? DEFAULTS.RANGE_DAYS;
  const location = parseKeywords(options.location);
  const hashtag = options.hashtag;
  const ownerNickname = options.ownerNickname;
  const order = options.order ?? DEFAULTS.ORDER;
  const minParticipantCount = options.minParticipants;
  const minLimit = options.minLimit;
  const useAi = options.useAi ?? false;

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

  return {
    content: `フィード設定を${existingFeed ? '更新' : '追加'}しました。\n\n${settings}`,
    ephemeral: false,
  };
}

/**
 * /connpass feed status コアハンドラー
 */
export async function handleFeedStatusCore(
  ctx: CommandContext,
  store: IFeedStore,
  getPrefectureName: PrefectureNameResolver = defaultPrefectureResolver
): Promise<CommandResponse> {
  const { channelId } = ctx;
  const feed = await store.get(channelId);

  if (!feed) {
    return {
      content: 'このチャンネルにはフィードが設定されていません。\n`/connpass feed set` で設定してください。',
      ephemeral: true,
    };
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

  return {
    content: `**このチャンネルのフィード設定**\n\n${settings}`,
    ephemeral: false,
  };
}

/**
 * /connpass feed remove コアハンドラー
 */
export async function handleFeedRemoveCore(
  ctx: CommandContext,
  store: IFeedStore,
  scheduler: IScheduler
): Promise<CommandResponse> {
  const { channelId } = ctx;
  const feed = await store.get(channelId);

  if (!feed) {
    return {
      content: 'このチャンネルにはフィードが設定されていません。',
      ephemeral: true,
    };
  }

  await scheduler.unscheduleFeed(channelId);
  await store.delete(channelId);

  return {
    content: 'フィード設定を削除しました。',
    ephemeral: false,
  };
}

/**
 * Feed設定からCLIコマンド文字列を生成
 * cron式のスペースはバックスラッシュでエスケープ
 */
export function generateFeedCommand(config: FeedConfig, targetChannelId?: string): string {
  const parts: string[] = [];
  const channelId = targetChannelId ?? config.channelId;

  // channels は必須
  parts.push(`channels:${channelId}`);

  // schedule（スペースをエスケープ）
  parts.push(`schedule:${config.schedule.replace(/ /g, '\\ ')}`);

  // 検索範囲日数
  if (config.rangeDays !== DEFAULTS.RANGE_DAYS) {
    parts.push(`range_days:${config.rangeDays}`);
  }

  // ANDキーワード
  if (config.keywordsAnd?.length) {
    parts.push(`keywords_and:${config.keywordsAnd.join(',')}`);
  }

  // ORキーワード
  if (config.keywordsOr?.length) {
    parts.push(`keywords_or:${config.keywordsOr.join(',')}`);
  }

  // 都道府県
  if (config.location?.length) {
    parts.push(`location:${config.location.join(',')}`);
  }

  // ハッシュタグ
  if (config.hashtag) {
    parts.push(`hashtag:${config.hashtag}`);
  }

  // 主催者ニックネーム
  if (config.ownerNickname) {
    parts.push(`owner_nickname:${config.ownerNickname}`);
  }

  // ソート順
  if (config.order && config.order !== DEFAULTS.ORDER) {
    parts.push(`order:${config.order}`);
  }

  // 規模フィルタ
  if (config.minParticipantCount !== undefined) {
    parts.push(`min_participants:${config.minParticipantCount}`);
  }

  if (config.minLimit !== undefined) {
    parts.push(`min_limit:${config.minLimit}`);
  }

  // AI機能
  if (config.useAi) {
    parts.push(`use_ai:true`);
  }

  return `/connpass feed apply ${parts.join(' ')}`;
}

/**
 * /connpass feed share コアハンドラー
 */
export async function handleFeedShareCore(
  ctx: CommandContext,
  store: IFeedStore
): Promise<CommandResponse> {
  const { channelId } = ctx;
  const feed = await store.get(channelId);

  if (!feed) {
    return {
      content: 'このチャンネルにはフィードが設定されていません。\n`/connpass feed set` で設定してください。',
      ephemeral: true,
    };
  }

  const command = generateFeedCommand(feed.config);

  const content = [
    'このチャンネルのFeed設定をコピーするコマンド:',
    '',
    `\`${command}\``,
    '',
    '複数チャンネルに適用する場合はchannelsをカンマ区切りで指定してください',
  ].join('\n');

  return {
    content,
    ephemeral: false,
  };
}

/**
 * /connpass feed apply コアハンドラー（CLI用）
 * 複数チャンネルにFeed設定を一括適用
 */
export async function handleFeedApplyCore(
  channelIds: string[],
  options: FeedSetOptions,
  store: IFeedStore,
  scheduler: IScheduler
): Promise<CommandResponse> {
  if (channelIds.length === 0) {
    return {
      content: 'チャンネルIDが指定されていません。\n形式: /connpass feed apply channels:123,456 schedule:...',
      ephemeral: true,
    };
  }

  const results: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const channelId of channelIds) {
    const ctx: CommandContext = {
      channelId,
      userId: 'cli-user',
      guildId: undefined,
    };

    try {
      const response = await handleFeedSetCore(ctx, options, store, scheduler);
      if (response.ephemeral) {
        // エラーの場合
        results.push(`❌ ${channelId}: ${response.content}`);
        errorCount++;
      } else {
        results.push(`✅ ${channelId}: 設定完了`);
        successCount++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(`❌ ${channelId}: ${message}`);
      errorCount++;
    }
  }

  const summary = `Feed設定を ${channelIds.length} チャンネルに適用しました（成功: ${successCount}, 失敗: ${errorCount}）`;

  return {
    content: [summary, '', ...results].join('\n'),
    ephemeral: false,
  };
}
