import { CronExpressionParser } from 'cron-parser';
import type { IFeedStore } from '@connpass-discord-bot/core';
import type { FeedExecutor } from '../executor/FeedExecutor.js';

export interface SchedulerOptions {
  /** チェック間隔（ミリ秒）。デフォルト: 60000 (1分) */
  checkIntervalMs?: number;
  /** API呼び出し間の遅延（ミリ秒）。デフォルト: 1100 (1.1秒) */
  rateLimitDelayMs?: number;
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
      this.checkAndExecute().catch(console.error);
    }, this.checkIntervalMs);

    console.log(`[Scheduler] Started with ${this.checkIntervalMs}ms check interval`);
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
    console.log('[Scheduler] Stopped');
  }

  /**
   * フィードの次回実行日時を計算して保存
   */
  async scheduleFeed(feedId: string): Promise<void> {
    const feed = await this.store.get(feedId);
    if (!feed) return;

    const nextRun = this.calculateNextRun(feed.config.schedule);
    if (nextRun) {
      feed.state.nextRunAt = nextRun;
      await this.store.save(feed);
      console.log(`[Scheduler] Feed ${feedId} next run: ${new Date(nextRun).toISOString()}`);
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
   * cron式から次回実行日時を計算
   */
  private calculateNextRun(schedule: string): number | undefined {
    try {
      const expression = CronExpressionParser.parse(schedule, {
        tz: 'Asia/Tokyo',
      });
      return expression.next().toDate().getTime();
    } catch (error) {
      console.error(`[Scheduler] Invalid cron expression: ${schedule}`, error);
      return undefined;
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

    console.log(`[Scheduler] Executing ${toExecute.length} feeds`);

    // レート制限を考慮して順次実行
    for (const feedId of toExecute) {
      try {
        const result = await this.executor.execute(feedId);
        if (result.error) {
          console.error(`[Scheduler] Feed ${feedId} error: ${result.error}`);
        } else {
          console.log(
            `[Scheduler] Feed ${feedId}: ${result.newCount}/${result.total} new events`
          );
        }
        // 次回実行をスケジュール
        await this.scheduleFeed(feedId);
      } catch (error) {
        console.error(`[Scheduler] Feed ${feedId} failed:`, error);
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
