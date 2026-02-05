import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CleanupScheduler } from './CleanupScheduler.js';
import type { CleanupStores } from './CleanupScheduler.js';

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

describe('CleanupScheduler', () => {
  let scheduler: CleanupScheduler;
  let mockStores: CleanupStores;

  beforeEach(() => {
    vi.useFakeTimers();

    mockStores = {
      logWriter: {
        cleanupAppLogs: vi.fn().mockResolvedValue(5),
        cleanupActionLogs: vi.fn().mockResolvedValue(3),
      } as any,
      feedStore: {
        cleanupSentEvents: vi.fn().mockResolvedValue(10),
      } as any,
      summaryCacheStore: {
        cleanup: vi.fn().mockResolvedValue(2),
      } as any,
      notifySentStore: {
        cleanupOlderThan: vi.fn().mockResolvedValue(7),
      } as any,
    };
  });

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('デフォルト設定', () => {
    it('デフォルトの保持日数が正しい', () => {
      scheduler = new CleanupScheduler({});
      const config = scheduler.getConfig();

      expect(config.appLogRetentionDays).toBe(7);
      expect(config.actionLogRetentionDays).toBe(30);
      expect(config.feedSentEventsRetentionDays).toBe(90);
      expect(config.summaryCacheRetentionDays).toBe(30);
      expect(config.notifySentRetentionDays).toBe(30);
    });

    it('カスタム設定で上書きできる', () => {
      scheduler = new CleanupScheduler({}, {
        config: {
          appLogRetentionDays: 3,
          actionLogRetentionDays: 14,
        },
      });
      const config = scheduler.getConfig();

      expect(config.appLogRetentionDays).toBe(3);
      expect(config.actionLogRetentionDays).toBe(14);
      expect(config.feedSentEventsRetentionDays).toBe(90); // デフォルト
    });
  });

  describe('runCleanup', () => {
    it('全てのストアをクリーンアップして結果を返す', async () => {
      scheduler = new CleanupScheduler(mockStores);

      const result = await scheduler.runCleanup();

      expect(result.appLogs).toBe(5);
      expect(result.actionLogs).toBe(3);
      expect(result.feedSentEvents).toBe(10);
      expect(result.summaryCache).toBe(2);
      expect(result.notifySent).toBe(7);
      expect(result.totalDeleted).toBe(27);
    });

    it('正しい保持日数で各ストアが呼ばれる', async () => {
      scheduler = new CleanupScheduler(mockStores, {
        config: {
          appLogRetentionDays: 5,
          actionLogRetentionDays: 15,
          feedSentEventsRetentionDays: 60,
          summaryCacheRetentionDays: 20,
          notifySentRetentionDays: 10,
        },
      });

      await scheduler.runCleanup();

      expect(mockStores.logWriter!.cleanupAppLogs).toHaveBeenCalledWith(5);
      expect(mockStores.logWriter!.cleanupActionLogs).toHaveBeenCalledWith(15);
      expect(mockStores.feedStore!.cleanupSentEvents).toHaveBeenCalledWith(60);
      expect(mockStores.summaryCacheStore!.cleanup).toHaveBeenCalledWith(20);
      expect(mockStores.notifySentStore!.cleanupOlderThan).toHaveBeenCalledWith(10);
    });

    it('ストアが未設定の場合はスキップする', async () => {
      scheduler = new CleanupScheduler({});

      const result = await scheduler.runCleanup();

      expect(result.totalDeleted).toBe(0);
      expect(result.appLogs).toBe(0);
      expect(result.actionLogs).toBe(0);
    });

    it('エラーが発生した場合はスローする', async () => {
      mockStores.logWriter!.cleanupAppLogs = vi.fn().mockRejectedValue(new Error('DB error'));

      scheduler = new CleanupScheduler(mockStores);

      await expect(scheduler.runCleanup()).rejects.toThrow('DB error');
    });
  });

  describe('start / stop', () => {
    it('start で即座にクリーンアップが実行される', async () => {
      scheduler = new CleanupScheduler(mockStores, { checkIntervalMs: 86400000 });
      await scheduler.start();

      expect(mockStores.logWriter!.cleanupAppLogs).toHaveBeenCalledTimes(1);
    });

    it('start を複数回呼んでも重複しない', async () => {
      scheduler = new CleanupScheduler(mockStores, { checkIntervalMs: 86400000 });
      await scheduler.start();
      await scheduler.start();

      expect(mockStores.logWriter!.cleanupAppLogs).toHaveBeenCalledTimes(1);
    });

    it('stop 後は定期実行されない', async () => {
      scheduler = new CleanupScheduler(mockStores, { checkIntervalMs: 60000 });
      await scheduler.start();
      await scheduler.stop();

      vi.advanceTimersByTime(120000);
      expect(mockStores.logWriter!.cleanupAppLogs).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConfig', () => {
    it('設定のコピーを返す（不変）', () => {
      scheduler = new CleanupScheduler({});
      const config1 = scheduler.getConfig();
      const config2 = scheduler.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // 別オブジェクト
    });
  });
});
