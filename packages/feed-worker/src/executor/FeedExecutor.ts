import type { ConnpassClient, Event } from '@kajidog/connpass-api-client';
import type { Feed, IFeedStore, ConnpassEvent } from '@connpass-discord-bot/core';
import { ORDER_MAP, DEFAULTS } from '@connpass-discord-bot/core';
import type { ISink } from './ISink.js';

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
 * フィード実行エンジン
 */
export class FeedExecutor {
  constructor(
    private readonly client: ConnpassClient,
    private readonly store: IFeedStore,
    private readonly sink: ISink
  ) {}

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

      // APIからイベントを取得
      const response = await this.client.searchEvents(params);
      let events = response.events as ConnpassEvent[];

      // ハッシュタグでクライアントサイドフィルタ
      if (feed.config.hashtag) {
        events = this.filterByHashtag(events, feed.config.hashtag);
      }

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
