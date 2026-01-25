import { CronExpressionParser } from 'cron-parser';
import type { IFeedStore } from '@connpass-discord-bot/core';
import { Logger, LogLevel, ActionType } from '@connpass-discord-bot/core';
import type { FeedExecutor } from '../executor/FeedExecutor.js';

const logger = Logger.getInstance();

export interface SchedulerOptions {
  /** チェック間隔（ミリ秒）。デフォルト: 60000 (1分) */
  checkIntervalMs?: number;
  /** API呼び出し間の遅延（ミリ秒）。デフォルト: 1100 (1.1秒) */
  rateLimitDelayMs?: number;
}

/**
 * cron式から次回実行日時を計算（共通ユーティリティ）
 */
export function calculateNextRunTime(schedule: string): number | undefined {
  try {
    const expression = CronExpressionParser.parse(schedule, {
      tz: 'Asia/Tokyo',
    });
    return expression.next().toDate().getTime();
  } catch {
    return undefined;
  }
}

/**
 * cron式ベースのフィードスケジューラー
 */
export class Scheduler {
  private checkInterval?: ReturnType<typeof setInterval>;
  private readonly checkIntervalMs: number;
  private readonly rateLimitDelayMs: number;
  private isRunning = false;

  constructor(
    private readonly store: IFeedStore,
    private readonly executor: FeedExecutor,
    options: SchedulerOptions = {}
  ) {
    this.checkIntervalMs = options.checkIntervalMs ?? 60_000;
    this.rateLimitDelayMs = options.rateLimitDelayMs ?? 1_100;
  }

  /**
   * スケジューラーを開始
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 初回チェック
    await this.checkAndExecute();

    // 定期チェックループ開始
    this.checkInterval = setInterval(() => {
      this.checkAndExecute().catch((error) => {
        logger.error('Scheduler', 'Check cycle failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.checkIntervalMs);

    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULER_START,
      component: 'Scheduler',
      message: `Scheduler started with ${this.checkIntervalMs}ms check interval`,
      metadata: { checkIntervalMs: this.checkIntervalMs },
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
      component: 'Scheduler',
      message: 'Scheduler stopped',
    });
  }

  /**
   * フィードの次回実行日時を計算して保存
   */
  async scheduleFeed(feedId: string): Promise<void> {
    const feed = await this.store.get(feedId);
    if (!feed) return;

    const nextRun = calculateNextRunTime(feed.config.schedule);
    if (nextRun) {
      feed.state.nextRunAt = nextRun;
      await this.store.save(feed);
      logger.debug('Scheduler', `Feed ${feedId} next run scheduled`, {
        feedId,
        nextRunAt: new Date(nextRun).toISOString(),
        channelId: feed.config.channelId,
      });
    }
  }

  /**
   * フィードのスケジュールを解除
   */
  async unscheduleFeed(feedId: string): Promise<void> {
    const feed = await this.store.get(feedId);
    if (feed) {
      feed.state.nextRunAt = undefined;
      await this.store.save(feed);
    }
  }

  /**
   * 実行が必要なフィードをチェックして実行
   */
  private async checkAndExecute(): Promise<void> {
    const now = Date.now();
    const feeds = await this.store.list();
    const toExecute: string[] = [];

    for (const feed of feeds) {
      const nextRun = feed.state.nextRunAt;
      if (nextRun && nextRun <= now) {
        toExecute.push(feed.config.id);
      }
    }

    if (toExecute.length === 0) return;

    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULER_EXECUTE,
      component: 'Scheduler',
      message: `Executing ${toExecute.length} feeds`,
      metadata: { feedCount: toExecute.length, feedIds: toExecute },
    });

    // レート制限を考慮して順次実行
    for (const feedId of toExecute) {
      const startTime = Date.now();
      try {
        const result = await this.executor.execute(feedId);
        const duration = Date.now() - startTime;

        if (result.error) {
          logger.logAction({
            level: LogLevel.ERROR,
            actionType: ActionType.SCHEDULER_ERROR,
            component: 'Scheduler',
            message: `Feed execution error: ${result.error}`,
            channelId: feedId,
            metadata: { feedId, error: result.error, durationMs: duration },
          });
        } else {
          logger.logAction({
            level: LogLevel.INFO,
            actionType: ActionType.SCHEDULER_EXECUTE,
            component: 'Scheduler',
            message: `Feed executed: ${result.newCount}/${result.total} new events`,
            channelId: feedId,
            metadata: {
              feedId,
              newCount: result.newCount,
              total: result.total,
              durationMs: duration,
            },
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logAction({
          level: LogLevel.ERROR,
          actionType: ActionType.SCHEDULER_ERROR,
          component: 'Scheduler',
          message: 'Feed execution failed',
          channelId: feedId,
          metadata: {
            feedId,
            error: error instanceof Error ? error.message : String(error),
            durationMs: duration,
          },
        });
      } finally {
        // エラー発生時でも必ず次回実行をスケジュール
        try {
          await this.scheduleFeed(feedId);
        } catch (scheduleError) {
          logger.error('Scheduler', `Failed to schedule next run for feed ${feedId}`, {
            feedId,
            error: scheduleError instanceof Error ? scheduleError.message : String(scheduleError),
          });
        }
      }

      // レート制限遅延
      if (toExecute.indexOf(feedId) < toExecute.length - 1) {
        await this.delay(this.rateLimitDelayMs);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
