import type { ConnpassClient, Event } from '@kajidog/connpass-api-client';
import type { Feed, IFeedStore, ConnpassEvent } from '@connpass-discord-bot/core';
import { ORDER_MAP, DEFAULTS, Logger } from '@connpass-discord-bot/core';
import type { ISink } from './ISink.js';

const logger = Logger.getInstance();

/**
 * フィード実行結果
 */
export interface ExecutionResult {
  feedId: string;
  total: number;
  newCount: number;
  error?: string;
}

/**
 * リトライ設定
 */
export interface RetryOptions {
  /** 最大リトライ回数。デフォルト: 3 */
  maxRetries?: number;
  /** 初期待機時間（ミリ秒）。デフォルト: 1000 */
  initialDelayMs?: number;
  /** 指数バックオフの乗数。デフォルト: 2 */
  backoffMultiplier?: number;
}

/**
 * リトライ対象のエラーかどうかを判定
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // ネットワークエラー
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed') ||
      message.includes('timeout')
    ) {
      return true;
    }
    // HTTP 5xx エラー
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return true;
    }
    // HTTP 429 レート制限
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
  }
  return false;
}

/**
 * フィード実行エンジン
 */
export class FeedExecutor {
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly backoffMultiplier: number;

  constructor(
    private readonly client: ConnpassClient,
    private readonly store: IFeedStore,
    private readonly sink: ISink,
    retryOptions: RetryOptions = {}
  ) {
    this.maxRetries = retryOptions.maxRetries ?? 3;
    this.initialDelayMs = retryOptions.initialDelayMs ?? 1000;
    this.backoffMultiplier = retryOptions.backoffMultiplier ?? 2;
  }

  /**
   * 指定されたフィードを実行
   */
  async execute(feedId: string): Promise<ExecutionResult> {
    const feed = await this.store.get(feedId);
    if (!feed) {
      return { feedId, total: 0, newCount: 0, error: 'Feed not found' };
    }

    try {
      // 検索パラメータを構築
      const params = this.buildSearchParams(feed);

      // APIからイベントを取得（リトライ付き）
      const response = await this.fetchWithRetry(params);
      let events = response.events as ConnpassEvent[];

      // ハッシュタグでクライアントサイドフィルタ
      if (feed.config.hashtag) {
        events = this.filterByHashtag(events, feed.config.hashtag);
      }

      // 規模フィルタ（参加人数・募集人数）
      events = this.filterByMinimumCounts(events, feed);

      // 新着イベントを判定
      const newEvents = this.filterNewEvents(events, feed);

      // 新着があればSinkに送信
      if (newEvents.length > 0) {
        await this.sink.handleNewEvents({
          feedId: feed.config.id,
          channelId: feed.config.channelId,
          events: newEvents,
        });
      }

      // 状態を更新
      this.updateState(feed, events);
      await this.store.save(feed);

      return {
        feedId,
        total: events.length,
        newCount: newEvents.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { feedId, total: 0, newCount: 0, error: message };
    }
  }

  /**
   * リトライ付きでAPI呼び出しを実行
   */
  private async fetchWithRetry(params: Record<string, unknown>): Promise<{ events: ConnpassEvent[] }> {
    let lastError: unknown;
    let delayMs = this.initialDelayMs;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.searchEvents(params);
        return response as { events: ConnpassEvent[] };
      } catch (error) {
        lastError = error;

        // リトライ対象のエラーでない場合は即座にスロー
        if (!isRetryableError(error)) {
          throw error;
        }

        // 最大リトライ回数に達した場合
        if (attempt >= this.maxRetries) {
          logger.warn('FeedExecutor', `API call failed after ${this.maxRetries} retries`, {
            error: error instanceof Error ? error.message : String(error),
            attempts: attempt + 1,
          });
          throw error;
        }

        // 次のリトライ前に待機
        logger.debug('FeedExecutor', `Retrying API call (attempt ${attempt + 1}/${this.maxRetries})`, {
          error: error instanceof Error ? error.message : String(error),
          delayMs,
        });
        await this.delay(delayMs);
        delayMs *= this.backoffMultiplier;
      }
    }

    throw lastError;
  }

  /**
   * 指定ミリ秒待機
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildSearchParams(feed: Feed): Record<string, unknown> {
    const now = new Date();
    const ymdFrom = this.formatYmd(now);
    const toDate = new Date(now);
    toDate.setDate(now.getDate() + (feed.config.rangeDays || DEFAULTS.RANGE_DAYS));
    const ymdTo = this.formatYmd(toDate);

    const params: Record<string, unknown> = {
      ymdFrom,
      ymdTo,
      order: ORDER_MAP[feed.config.order || DEFAULTS.ORDER],
      count: 100,
    };

    if (feed.config.keywordsAnd?.length) {
      params.keyword = feed.config.keywordsAnd;
    }
    if (feed.config.keywordsOr?.length) {
      params.keywordOr = feed.config.keywordsOr;
    }
    if (feed.config.location?.length) {
      params.prefecture = feed.config.location;
    }
    if (feed.config.ownerNickname) {
      params.ownerNickname = feed.config.ownerNickname;
    }

    return params;
  }

  private formatYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private filterByHashtag(events: ConnpassEvent[], hashtag: string): ConnpassEvent[] {
    const normalized = hashtag.toLowerCase().replace(/^#/, '');
    return events.filter(
      (e) => e.hashTag?.toLowerCase().replace(/^#/, '') === normalized
    );
  }

  private filterByMinimumCounts(events: ConnpassEvent[], feed: Feed): ConnpassEvent[] {
    const { minParticipantCount, minLimit } = feed.config;
    if (minParticipantCount === undefined && minLimit === undefined) {
      return events;
    }

    return events.filter((event) => {
      const participantOk =
        minParticipantCount !== undefined && event.participantCount >= minParticipantCount;
      const limitValue =
        event.limit === undefined || event.limit === 0 ? Number.POSITIVE_INFINITY : event.limit;
      const limitOk = minLimit !== undefined && limitValue >= minLimit;

      return participantOk || limitOk;
    });
  }

  private filterNewEvents(events: ConnpassEvent[], feed: Feed): ConnpassEvent[] {
    const sentEvents = feed.state.sentEvents || {};

    return events.filter((e) => {
      const sentUpdatedAt = sentEvents[e.id];
      // 未送信、または更新されている場合は新着とみなす
      return !sentUpdatedAt || sentUpdatedAt !== e.updatedAt;
    });
  }

  private updateState(feed: Feed, events: ConnpassEvent[]): void {
    if (!feed.state.sentEvents) {
      feed.state.sentEvents = {};
    }

    // 送信済みイベントを更新
    for (const e of events) {
      feed.state.sentEvents[e.id] = e.updatedAt;
    }

    feed.state.lastRunAt = Date.now();
  }
}
