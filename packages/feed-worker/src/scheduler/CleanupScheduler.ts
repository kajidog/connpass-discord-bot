import { Logger, LogLevel, ActionType } from '@connpass-discord-bot/core';
import type { DrizzleLogWriter } from '../storage/drizzle/DrizzleLogWriter.js';
import type { DrizzleFeedStore } from '../storage/drizzle/DrizzleFeedStore.js';
import type { DrizzleSummaryCacheStore } from '../storage/drizzle/DrizzleSummaryCacheStore.js';
import type { DrizzleUserNotifySentStore } from '../storage/drizzle/DrizzleUserNotifySentStore.js';

const logger = Logger.getInstance();

/**
 * クリーンアップ対象と保持日数の設定
 */
export interface CleanupConfig {
  /** アプリログの保持日数（デフォルト: 7日） */
  appLogRetentionDays?: number;
  /** アクションログの保持日数（デフォルト: 30日） */
  actionLogRetentionDays?: number;
  /** 送信済みイベントの保持日数（デフォルト: 90日） */
  feedSentEventsRetentionDays?: number;
  /** イベント要約キャッシュの保持日数（デフォルト: 30日） */
  summaryCacheRetentionDays?: number;
  /** 通知送信済みの保持日数（デフォルト: 30日） */
  notifySentRetentionDays?: number;
}

/**
 * クリーンアップ対象のストア群
 */
export interface CleanupStores {
  logWriter?: DrizzleLogWriter;
  feedStore?: DrizzleFeedStore;
  summaryCacheStore?: DrizzleSummaryCacheStore;
  notifySentStore?: DrizzleUserNotifySentStore;
}

export interface CleanupSchedulerOptions {
  /** チェック間隔（ミリ秒）。デフォルト: 86400000 (24時間) */
  checkIntervalMs?: number;
  /** 保持期間設定 */
  config?: CleanupConfig;
}

/**
 * クリーンアップ結果
 */
export interface CleanupResult {
  appLogs: number;
  actionLogs: number;
  feedSentEvents: number;
  summaryCache: number;
  notifySent: number;
  totalDeleted: number;
}

/**
 * DBクリーンアップスケジューラー
 * 古いレコードを定期的に削除してDBサイズの肥大化を防ぐ
 */
export class CleanupScheduler {
  private checkInterval?: ReturnType<typeof setInterval>;
  private readonly checkIntervalMs: number;
  private readonly config: Required<CleanupConfig>;
  private isRunning = false;

  constructor(
    private readonly stores: CleanupStores,
    options: CleanupSchedulerOptions = {}
  ) {
    this.checkIntervalMs = options.checkIntervalMs ?? 24 * 60 * 60 * 1000; // 24時間
    this.config = {
      appLogRetentionDays: options.config?.appLogRetentionDays ?? 7,
      actionLogRetentionDays: options.config?.actionLogRetentionDays ?? 30,
      feedSentEventsRetentionDays: options.config?.feedSentEventsRetentionDays ?? 90,
      summaryCacheRetentionDays: options.config?.summaryCacheRetentionDays ?? 30,
      notifySentRetentionDays: options.config?.notifySentRetentionDays ?? 30,
    };
  }

  /**
   * スケジューラーを開始
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 起動時に即座にクリーンアップ実行
    await this.runCleanup();

    // 定期クリーンアップループ開始
    this.checkInterval = setInterval(() => {
      this.runCleanup().catch((error) => {
        logger.error('CleanupScheduler', 'Cleanup cycle failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.checkIntervalMs);

    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULER_START,
      component: 'CleanupScheduler',
      message: `CleanupScheduler started with ${this.checkIntervalMs}ms interval`,
      metadata: {
        checkIntervalMs: this.checkIntervalMs,
        config: this.config,
      },
    });
  }

  /**
   * スケジューラーを停止
   */
  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.isRunning = false;
    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULER_STOP,
      component: 'CleanupScheduler',
      message: 'CleanupScheduler stopped',
    });
  }

  /**
   * クリーンアップを即座に実行
   */
  async runCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      appLogs: 0,
      actionLogs: 0,
      feedSentEvents: 0,
      summaryCache: 0,
      notifySent: 0,
      totalDeleted: 0,
    };

    const startTime = Date.now();

    try {
      // アプリログのクリーンアップ
      if (this.stores.logWriter) {
        result.appLogs = await this.stores.logWriter.cleanupAppLogs(
          this.config.appLogRetentionDays
        );
        result.actionLogs = await this.stores.logWriter.cleanupActionLogs(
          this.config.actionLogRetentionDays
        );
      }

      // 送信済みイベントのクリーンアップ
      if (this.stores.feedStore) {
        result.feedSentEvents = await this.stores.feedStore.cleanupSentEvents(
          this.config.feedSentEventsRetentionDays
        );
      }

      // 要約キャッシュのクリーンアップ
      if (this.stores.summaryCacheStore) {
        result.summaryCache = await this.stores.summaryCacheStore.cleanup(
          this.config.summaryCacheRetentionDays
        );
      }

      // 通知送信済みのクリーンアップ
      if (this.stores.notifySentStore) {
        result.notifySent = await this.stores.notifySentStore.cleanupOlderThan(
          this.config.notifySentRetentionDays
        );
      }

      result.totalDeleted =
        result.appLogs +
        result.actionLogs +
        result.feedSentEvents +
        result.summaryCache +
        result.notifySent;

      const duration = Date.now() - startTime;

      if (result.totalDeleted > 0) {
        logger.logAction({
          level: LogLevel.INFO,
          actionType: ActionType.GENERAL,
          component: 'CleanupScheduler',
          message: `Cleanup completed: ${result.totalDeleted} records deleted`,
          metadata: {
            ...result,
            durationMs: duration,
          },
        });
      } else {
        logger.debug('CleanupScheduler', 'Cleanup completed: no records to delete', {
          durationMs: duration,
        });
      }

      return result;
    } catch (error) {
      logger.error('CleanupScheduler', 'Cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): Readonly<Required<CleanupConfig>> {
    return { ...this.config };
  }
}
