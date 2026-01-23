import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler } from './Scheduler.js';
import type { IFeedStore, Feed } from '@connpass-discord-bot/core';
import type { FeedExecutor } from '../executor/FeedExecutor.js';
import type { ExecutionResult } from '../executor/FeedExecutor.js';

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

describe('Scheduler', () => {
  let mockStore: IFeedStore;
  let mockExecutor: FeedExecutor;
  let scheduler: Scheduler;

  const createMockFeed = (id: string, nextRunAt?: number): Feed => ({
    config: {
      id,
      channelId: `channel-${id}`,
      schedule: '0 * * * *', // 毎時0分
      rangeDays: 14,
      order: 'started_asc',
    },
    state: {
      sentEvents: {},
      nextRunAt,
    },
  });

  beforeEach(() => {
    vi.useFakeTimers();

    // モックストアを作成
    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };

    // モックエグゼキュータを作成
    mockExecutor = {
      execute: vi.fn(),
    } as unknown as FeedExecutor;
  });

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('scheduleFeed', () => {
    it('フィードの次回実行日時を正しく計算して保存する', async () => {
      const feed = createMockFeed('feed-1');
      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.scheduleFeed('feed-1');

      expect(mockStore.get).toHaveBeenCalledWith('feed-1');
      expect(mockStore.save).toHaveBeenCalled();
      expect(feed.state.nextRunAt).toBeDefined();
      expect(feed.state.nextRunAt).toBeGreaterThan(Date.now());
    });

    it('存在しないフィードの場合は何もしない', async () => {
      vi.mocked(mockStore.get).mockResolvedValue(undefined);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.scheduleFeed('non-existent');

      expect(mockStore.get).toHaveBeenCalledWith('non-existent');
      expect(mockStore.save).not.toHaveBeenCalled();
    });
  });

  describe('checkAndExecute', () => {
    it('実行時刻に達したフィードを正常に実行する', async () => {
      const now = Date.now();
      const pastTime = now - 1000; // 1秒前

      const feed = createMockFeed('feed-1', pastTime);
      vi.mocked(mockStore.list).mockResolvedValue([feed]);
      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockExecutor.execute).mockResolvedValue({
        feedId: 'feed-1',
        total: 10,
        newCount: 2,
      } as ExecutionResult);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      // start() は初回チェックを実行するため、await で完了を待つ
      await scheduler.start();

      // 初回チェックで実行されるはず
      expect(mockExecutor.execute).toHaveBeenCalledWith('feed-1');
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('実行時刻に達していないフィードは実行しない', async () => {
      const now = Date.now();
      const futureTime = now + 60000; // 1分後

      const feed = createMockFeed('feed-1', futureTime);
      vi.mocked(mockStore.list).mockResolvedValue([feed]);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.start();

      expect(mockExecutor.execute).not.toHaveBeenCalled();
    });

    it('executor がエラーを返しても次回スケジュールが設定される', async () => {
      const now = Date.now();
      const pastTime = now - 1000;

      const feed = createMockFeed('feed-1', pastTime);
      vi.mocked(mockStore.list).mockResolvedValue([feed]);
      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockExecutor.execute).mockResolvedValue({
        feedId: 'feed-1',
        total: 0,
        newCount: 0,
        error: 'API error',
      } as ExecutionResult);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.start();

      // エラーが返されても scheduleFeed が呼ばれる（save が呼ばれる）
      expect(mockStore.save).toHaveBeenCalled();
      expect(feed.state.nextRunAt).toBeDefined();
    });

    it('executor が例外をスローしても次回スケジュールが設定される', async () => {
      const now = Date.now();
      const pastTime = now - 1000;

      const feed = createMockFeed('feed-1', pastTime);
      vi.mocked(mockStore.list).mockResolvedValue([feed]);
      vi.mocked(mockStore.get).mockResolvedValue(feed);
      vi.mocked(mockStore.save).mockResolvedValue(undefined);
      vi.mocked(mockExecutor.execute).mockRejectedValue(new Error('Network error'));

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.start();

      // 例外がスローされても scheduleFeed が finally ブロックで呼ばれる
      expect(mockStore.save).toHaveBeenCalled();
      expect(feed.state.nextRunAt).toBeDefined();
    });

  });

  describe('start/stop', () => {
    it('start を複数回呼んでも重複して開始されない', async () => {
      vi.mocked(mockStore.list).mockResolvedValue([]);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.start();
      await scheduler.start();

      // list は初回チェックで1回だけ呼ばれる
      expect(mockStore.list).toHaveBeenCalledTimes(1);
    });

    it('stop で正常に停止できる', async () => {
      vi.mocked(mockStore.list).mockResolvedValue([]);

      scheduler = new Scheduler(mockStore, mockExecutor, { checkIntervalMs: 60000 });
      await scheduler.start();
      await scheduler.stop();

      // stop 後は新しいチェックが実行されない
      vi.advanceTimersByTime(120000);
      expect(mockStore.list).toHaveBeenCalledTimes(1);
    });
  });
});
