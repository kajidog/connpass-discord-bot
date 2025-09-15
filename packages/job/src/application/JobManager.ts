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

  const params: any = { ymdFrom: from, ymdTo: to, order: job.order ?? 2 };

  if (job.keyword && job.keyword.length) {
    params.keyword = job.keyword;
  }
  if (job.keywordOr && job.keywordOr.length) {
    params.keywordOr = job.keywordOr;
  }
  if (job.prefecture && job.prefecture.length) {
    params.prefecture = job.prefecture;
  }
  if (job.ownerNickname) {
    params.ownerNickname = job.ownerNickname;
  }

  return params;
}

function normalizeTag(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.replace(/^#/, '').toLowerCase();
}

function filterByHashTag(events: Event[], hashTag?: string): Event[] {
  const wanted = normalizeTag(hashTag);
  if (!wanted) return events;
  return events.filter((e) => normalizeTag(e.hashTag) === wanted);
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
      id: config.id,
      channelId: config.channelId ?? existing?.channelId ?? config.id,
      keyword: config.keyword ?? existing?.keyword,
      keywordOr: config.keywordOr ?? existing?.keywordOr,
      rangeDays: config.rangeDays ?? existing?.rangeDays ?? 14,
      prefecture: config.prefecture ?? existing?.prefecture,
      hashTag: config.hashTag ?? existing?.hashTag,
      ownerNickname: config.ownerNickname ?? existing?.ownerNickname,
      order: (config as any).order ?? existing?.order,
      intervalSec: config.intervalSec ?? existing?.intervalSec ?? 1800,
      reportAiDefault: (config as any).reportAiDefault ?? existing?.reportAiDefault,
      reportSummaryTemplate: (config as any).reportSummaryTemplate ?? existing?.reportSummaryTemplate,
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
    const filtered = filterByHashTag(resp.events, job.hashTag);

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
