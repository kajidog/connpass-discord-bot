import { Job } from '../domain/types';
import { JobManager } from './JobManager';

export class JobScheduler {
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly manager: JobManager) {}

  async start(jobId: string): Promise<void> {
    await this.stop(jobId);
    const job = await this.manager.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    const intervalMs = (job.intervalSec ?? 1800) * 1000;

    // run immediately, then on interval
    this.manager.runOnce(jobId).catch(() => {});
    const timer = setInterval(() => {
      this.manager.runOnce(jobId).catch(() => {});
    }, intervalMs);
    this.timers.set(jobId, timer);
  }

  async stop(jobId: string): Promise<void> {
    const t = this.timers.get(jobId);
    if (t) {
      clearInterval(t);
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

