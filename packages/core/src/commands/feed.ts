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
