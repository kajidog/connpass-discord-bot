import { Job } from '../domain/types';
import { JobManager } from './JobManager';

type Timers = { feed?: NodeJS.Timeout; report?: NodeJS.Timeout };
type ScheduleMode = 'interval' | 'scheduled'; // 実行モード

export class JobScheduler {
  private timers = new Map<string, Timers>();
  private nextExecutionCache = new Map<string, number>(); // メモリキャッシュ
  private executionChecker?: NodeJS.Timeout;
  private readonly mode: ScheduleMode;

  constructor(private readonly manager: JobManager, options?: { mode?: ScheduleMode }) {
    this.mode = options?.mode || 'scheduled'; // デフォルトは新方式

    if (this.mode === 'scheduled') {
      // 1分ごとに実行チェック
      this.executionChecker = setInterval(() => {
        this.checkAndExecuteJobs();
      }, 60 * 1000);
    }
  }

  private async checkAndExecuteJobs(): Promise<void> {
    const now = Date.now();
    const jobs = await this.manager.list();
    const executionQueue: string[] = [];

    for (const job of jobs) {
      // キャッシュから次回実行時刻を取得
      const nextRun = this.nextExecutionCache.get(job.id) || job.state.nextRunAt;

      if (nextRun && nextRun <= now) {
        executionQueue.push(job.id);
      }
    }

    // レート制限対策: 1.1秒間隔で順次実行
    for (let i = 0; i < executionQueue.length; i++) {
      setTimeout(() => {
        this.executeScheduledJob(executionQueue[i]);
      }, i * 1100);
    }
  }

  private async executeScheduledJob(jobId: string): Promise<void> {
    try {
      await this.manager.runOnce(jobId);

      const job = await this.manager.get(jobId);
      if (job) {
        const nextRunAt = Date.now() + job.intervalSec * 1000;

        // 次回実行時刻を更新
        job.state.nextRunAt = nextRunAt;
        this.nextExecutionCache.set(jobId, nextRunAt);

        // 永続化
        await this.manager.save(job);
      }
    } catch (error) {
      console.error(`Failed to execute job ${jobId}:`, error);
    }
  }

  async start(jobId: string): Promise<void> {
    if (this.mode === 'interval') {
      // 既存の処理（後方互換性）
      await this.startIntervalMode(jobId);
    } else {
      await this.startScheduledMode(jobId);
    }
  }

  private async startIntervalMode(jobId: string): Promise<void> {
    await this.stop(jobId);
    const job = await this.manager.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const feedIntervalMs = (job.intervalSec ?? 1800) * 1000;
    const timers: Timers = {};

    // Feed: schedule periodic execution (no immediate run)
    timers.feed = setInterval(() => {
      this.manager.runOnce(jobId).catch(() => {});
    }, feedIntervalMs);

    // Scheduled report: if enabled, schedule periodic execution (no immediate run)
    if (job.reportEnabled) {
      const reportIntervalMs = Math.max(60, job.reportIntervalSec ?? 24 * 60 * 60) * 1000;
      timers.report = setInterval(() => {
        this.manager.postReport(jobId).catch(() => {});
      }, reportIntervalMs);
    }

    this.timers.set(jobId, timers);
  }

  private async startScheduledMode(jobId: string): Promise<void> {
    const job = await this.manager.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const now = Date.now();

    // 次回実行時刻が設定されていない、または過去の場合は即時実行
    if (!job.state.nextRunAt || job.state.nextRunAt <= now) {
      // 少し遅延させて実行（他のジョブとの競合回避）
      setTimeout(() => {
        this.executeScheduledJob(jobId);
      }, Math.random() * 1000);
    } else {
      // キャッシュに登録
      this.nextExecutionCache.set(jobId, job.state.nextRunAt);
    }
  }

  async stop(jobId: string): Promise<void> {
    const t = this.timers.get(jobId);
    if (t) {
      if (t.feed) clearInterval(t.feed);
      if (t.report) clearInterval(t.report);
      this.timers.delete(jobId);
    }
  }

  async restart(jobId: string): Promise<void> {
    await this.start(jobId);
  }

  async startAll(): Promise<void> {
    const jobs = await this.manager.list();
    const now = Date.now();
    const immediateJobs: string[] = [];

    for (const job of jobs) {
      if (this.mode === 'scheduled') {
        if (!job.state.nextRunAt || job.state.nextRunAt <= now) {
          immediateJobs.push(job.id);
        } else {
          this.nextExecutionCache.set(job.id, job.state.nextRunAt);
        }
      } else {
        await this.start(job.id);
      }
    }

    // scheduled モードで即時実行が必要なジョブを順次実行
    if (this.mode === 'scheduled') {
      for (let i = 0; i < immediateJobs.length; i++) {
        setTimeout(() => {
          this.executeScheduledJob(immediateJobs[i]);
        }, i * 1100); // 1.1秒間隔
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const id of Array.from(this.timers.keys())) {
      await this.stop(id);
    }
    if (this.executionChecker) {
      clearInterval(this.executionChecker);
    }
  }
}
