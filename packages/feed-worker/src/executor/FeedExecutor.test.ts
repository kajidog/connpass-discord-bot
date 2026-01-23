import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedExecutor, isRetryableError } from './FeedExecutor.js';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type { IFeedStore, Feed, ConnpassEvent } from '@connpass-discord-bot/core';
import type { ISink } from './ISink.js';

// Logger をモック
vi.mock('@connpass-discord-bot/core', async () => {
  const actual = await vi.importActual('@connpass-discord-bot/core');
  return {
    ...actual,
    Logger: {
      getInstance: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        logAction: vi.fn(),
      }),
    },
  };
});

describe('isRetryableError', () => {
  it('ネットワークエラーはリトライ対象', () => {
    expect(isRetryableError(new Error('network error'))).toBe(true);
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('HTTP 5xx エラーはリトライ対象', () => {
    expect(isRetryableError(new Error('HTTP 500 Internal Server Error'))).toBe(true);
    expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true);
  });

  it('HTTP 429 レート制限はリトライ対象', () => {
    expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
  });

  it('その他のエラーはリトライ対象外', () => {
    expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
    expect(isRetryableError(new Error('Not found'))).toBe(false);
    expect(isRetryableError(new Error('Bad request'))).toBe(false);
    expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
    expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
  });

  it('Error 以外のオブジェクトはリトライ対象外', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError({ message: 'object error' })).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('FeedExecutor', () => {
  let mockClient: ConnpassClient;
  let mockStore: IFeedStore;
  let mockSink: ISink;
  let executor: FeedExecutor;

  const createMockFeed = (id: string): Feed => ({
    config: {
      id,
      channelId: `channel-${id}`,
      schedule: '0 * * * *',
      rangeDays: 14,
      order: 'started_asc',
    },
    state: {
      sentEvents: {},
    },
  });

  const createMockEvent = (id: number): ConnpassEvent => ({
    id,
    title: `Event ${id}`,
    catchPhrase: 'Catch phrase',
    description: 'Description',
    url: `https://example.com/event/${id}`,
    hashTag: '',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    limit: 100,
    waitingCount: 0,
    participantCount: 50,
    updatedAt: new Date().toISOString(),
    ownerNickname: 'owner',
    ownerDisplayName: 'Owner',
    place: 'Tokyo',
    address: 'Tokyo, Japan',
    lat: 35.6762,
    lon: 139.6503,
    groupTitle: '',
    groupId: 0,
  });

  const createMockEventsResponse = (events: ConnpassEvent[]) => ({
    events,
    eventsReturned: events.length,
    eventsAvailable: events.length,
    eventsStart: 1,
  });

  beforeEach(() => {
    vi.useFakeTimers();

    mockClient = {
      searchEvents: vi.fn(),
    } as unknown as ConnpassClient;

    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };

    mockSink = {
      handleNewEvents: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('execute - 成功ケース', () => {
    it('正常にイベントを取得して新着を検出する', async () => {
      const feed = createMockFeed('feed-1');
      const events = [createMockEvent(1), createMockEvent(2)];

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockClient.searchEvents).mockResolvedValue(createMockEventsResponse(events));
      vi.mocked(mockSink.handleNewEvents).mockResolvedValue(undefined);

      executor = new FeedExecutor(mockClient, mockStore, mockSink);
      const result = await executor.execute('feed-1');

      expect(result.feedId).toBe('feed-1');
      expect(result.total).toBe(2);
      expect(result.newCount).toBe(2);
      expect(result.error).toBeUndefined();
      expect(mockSink.handleNewEvents).toHaveBeenCalledWith({
        feedId: 'feed-1',
        channelId: 'channel-feed-1',
        events,
      });
    });

    it('既に送信済みのイベントは新着としてカウントされない', async () => {
      const event = createMockEvent(1);
      const feed = createMockFeed('feed-1');
      feed.state.sentEvents = { 1: event.updatedAt };

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockClient.searchEvents).mockResolvedValue(createMockEventsResponse([event]));

      executor = new FeedExecutor(mockClient, mockStore, mockSink);
      const result = await executor.execute('feed-1');

      expect(result.newCount).toBe(0);
      expect(mockSink.handleNewEvents).not.toHaveBeenCalled();
    });

    it('存在しないフィードの場合はエラーを返す', async () => {
      vi.mocked(mockStore.get).mockResolvedValue(undefined);

      executor = new FeedExecutor(mockClient, mockStore, mockSink);
      const result = await executor.execute('non-existent');

      expect(result.error).toBe('Feed not found');
      expect(result.total).toBe(0);
      expect(result.newCount).toBe(0);
    });
  });

  describe('execute - リトライロジック', () => {
    it('一時的なエラー後にリトライして成功する', async () => {
      const feed = createMockFeed('feed-1');
      const events = [createMockEvent(1)];

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockClient.searchEvents)
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValueOnce(createMockEventsResponse(events));

      executor = new FeedExecutor(mockClient, mockStore, mockSink, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 2,
      });

      const resultPromise = executor.execute('feed-1');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.total).toBe(1);
      expect(result.error).toBeUndefined();
      expect(mockClient.searchEvents).toHaveBeenCalledTimes(3);
    });

    it('最大リトライ回数を超えるとエラーを返す', async () => {
      const feed = createMockFeed('feed-1');

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockClient.searchEvents).mockRejectedValue(new Error('ETIMEDOUT'));

      executor = new FeedExecutor(mockClient, mockStore, mockSink, {
        maxRetries: 2,
        initialDelayMs: 10,
        backoffMultiplier: 2,
      });

      const resultPromise = executor.execute('feed-1');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.error).toBe('ETIMEDOUT');
      expect(result.total).toBe(0);
      // 初回 + 2回リトライ = 3回
      expect(mockClient.searchEvents).toHaveBeenCalledTimes(3);
    });

    it('リトライ対象外のエラーは即座にエラーを返す', async () => {
      const feed = createMockFeed('feed-1');

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockClient.searchEvents).mockRejectedValue(new Error('401 Unauthorized'));

      executor = new FeedExecutor(mockClient, mockStore, mockSink, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      const result = await executor.execute('feed-1');

      expect(result.error).toBe('401 Unauthorized');
      expect(mockClient.searchEvents).toHaveBeenCalledTimes(1);
    });

    it('レート制限エラー (429) はリトライされる', async () => {
      const feed = createMockFeed('feed-1');
      const events = [createMockEvent(1)];

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockClient.searchEvents)
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce(createMockEventsResponse(events));

      executor = new FeedExecutor(mockClient, mockStore, mockSink, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      const resultPromise = executor.execute('feed-1');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.total).toBe(1);
      expect(result.error).toBeUndefined();
      expect(mockClient.searchEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('execute - フィルタリング', () => {
    it('ハッシュタグでフィルタリングされる', async () => {
      const feed = createMockFeed('feed-1');
      feed.config.hashtag = 'typescript';

      const event1 = createMockEvent(1);
      event1.hashTag = 'typescript';
      const event2 = createMockEvent(2);
      event2.hashTag = 'javascript';

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockClient.searchEvents).mockResolvedValue(createMockEventsResponse([event1, event2]));

      executor = new FeedExecutor(mockClient, mockStore, mockSink);
      const result = await executor.execute('feed-1');

      expect(result.total).toBe(1);
      expect(mockSink.handleNewEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          events: [event1],
        })
      );
    });

    it('最小参加者数でフィルタリングされる', async () => {
      const feed = createMockFeed('feed-1');
      feed.config.minParticipantCount = 30;

      const event1 = createMockEvent(1);
      event1.participantCount = 50;
      const event2 = createMockEvent(2);
      event2.participantCount = 20;

      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockClient.searchEvents).mockResolvedValue(createMockEventsResponse([event1, event2]));

      executor = new FeedExecutor(mockClient, mockStore, mockSink);
      const result = await executor.execute('feed-1');

      expect(result.total).toBe(1);
    });
  });
});
