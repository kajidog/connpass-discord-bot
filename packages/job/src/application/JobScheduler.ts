import { Job } from '../domain/types';
import { JobManager } from './JobManager';

type Timers = { feed?: NodeJS.Timeout; report?: NodeJS.Timeout };

export class JobScheduler {
  private timers = new Map<string, Timers>();

  constructor(private readonly manager: JobManager) {}

  async start(jobId: string): Promise<void> {
    await this.stop(jobId);
    const job = await this.manager.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const feedIntervalMs = (job.intervalSec ?? 1800) * 1000;
    const timers: Timers = {};

    // Feed: run immediately, then on interval
    this.manager.runOnce(jobId).catch(() => {});
    timers.feed = setInterval(() => {
      this.manager.runOnce(jobId).catch(() => {});
    }, feedIntervalMs);

    // Scheduled report: if enabled
    if (job.reportEnabled) {
      const reportIntervalMs = Math.max(60, job.reportIntervalSec ?? 24 * 60 * 60) * 1000;
      // run immediately too
      this.manager.postReport(jobId).catch(() => {});
      timers.report = setInterval(() => {
        this.manager.postReport(jobId).catch(() => {});
      }, reportIntervalMs);
    }

    this.timers.set(jobId, timers);
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
    for (const j of jobs) {
      await this.start(j.id);
    }
  }

  async stopAll(): Promise<void> {
    for (const id of Array.from(this.timers.keys())) {
      await this.stop(id);
    }
  }
}
