import { ConnpassClient, EventsResponse, Event } from '@connpass-discord-bot/api-client';
import { Job, JobConfig, JobSink } from '../domain/types';
import { IJobStore } from '../domain/repositories/IJobStore';

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  // Connpass API expects YYYY-MM-DD format for ymdFrom/ymdTo
  return `${y}-${m}-${d}`;
}

function buildSearchParams(job: Job) {
  const now = new Date();
  const from = ymd(now);
  const toDate = new Date(now);
  const rangeDays = job.rangeDays ?? 14;
  toDate.setDate(now.getDate() + rangeDays);
  const to = ymd(toDate);

  const params: any = { ymdFrom: from, ymdTo: to, order: 2 };

  if (job.mode === 'and' && job.keyword && job.keyword.length) {
    params.keyword = job.keyword.join(',');
  } else if (job.mode === 'or' && job.keywordOr && job.keywordOr.length) {
    params.keywordOr = job.keywordOr.join(',');
  }

  return params;
}

function filterByLocation(events: Event[], location?: string): Event[] {
  if (!location) return events;
  const needle = location.toLowerCase();
  return events.filter((e) => {
    const target = `${e.place ?? ''} ${e.address ?? ''}`.toLowerCase();
    return target.includes(needle);
  });
}

export class JobManager {
  constructor(
    private readonly client: ConnpassClient,
    private readonly store: IJobStore,
    private readonly sink: JobSink,
  ) {}

  async upsert(config: JobConfig): Promise<Job> {
    const existing = await this.store.get(config.id);
    const job: Job = {
      ...config,
      intervalSec: config.intervalSec ?? 1800,
      rangeDays: config.rangeDays ?? 14,
      state: existing?.state ?? { seenEventIds: new Set<number>() },
    };
    await this.store.save(job);
    return job;
  }

  async remove(jobId: string): Promise<void> {
    await this.store.delete(jobId);
  }

  async get(jobId: string): Promise<Job | undefined> {
    return this.store.get(jobId);
  }

  async list(): Promise<Job[]> {
    return this.store.list();
  }

  // Execute a job once and push new events to sink
  async runOnce(jobId: string): Promise<EventsResponse> {
    const job = await this.store.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const params = buildSearchParams(job);
    const resp = await this.client.searchEvents(params);
    const filtered = filterByLocation(resp.events, job.location);

    const newOnes: Event[] = [];
    // initialize state storage (Set is not serializable if persisted; but InMemory store is fine)
    if (!job.state.seenEventIds) job.state.seenEventIds = new Set<number>();
    let lastUpdated = job.state.lastEventUpdatedAt ? new Date(job.state.lastEventUpdatedAt) : undefined;

    for (const e of filtered) {
      const isNewById = !job.state.seenEventIds.has(e.id);
      const eUpdated = new Date(e.updatedAt);
      const isNewByUpdatedAt = !lastUpdated || eUpdated > lastUpdated;
      if (isNewById || isNewByUpdatedAt) {
        newOnes.push(e);
        job.state.seenEventIds.add(e.id);
        if (!lastUpdated || eUpdated > lastUpdated) {
          lastUpdated = eUpdated;
        }
      }
    }

    if (newOnes.length > 0) {
      await Promise.resolve(this.sink.handleNewEvents({ jobId: job.id, channelId: job.channelId, events: newOnes }));
    }

    job.state.lastEventUpdatedAt = lastUpdated?.toISOString();
    job.state.lastRunAt = Date.now();
    await this.store.save(job);

    return { ...resp, events: filtered };
  }
}
