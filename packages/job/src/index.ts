import { ConnpassClient } from '@connpass-discord-bot/api-client';
import { JobManager } from './application/JobManager';
import { JobScheduler } from './application/JobScheduler';
import { UserManager } from './application/UserManager';
import { InMemoryJobStore } from './infrastructure/InMemoryJobStore';
import { InMemoryUserStore } from './infrastructure/InMemoryUserStore';
import { FileJobStore } from './infrastructure/FileJobStore';
import { FileUserStore } from './infrastructure/FileUserStore';
import { startHttpApi } from './infrastructure/HttpApiServer';
import type { JobSink, JobConfig, Job, NewEventsPayload, ReportPayload, ReportPayloadMeta } from './domain/types';
import type { IJobStore as JobStore } from './domain/repositories/IJobStore';
import type { User } from './domain/User';
import type { IUserStore as UserStore } from './domain/repositories/IUserStore';

export {
  JobManager,
  JobScheduler,
  UserManager,
  InMemoryJobStore,
  InMemoryUserStore,
  FileJobStore,
  FileUserStore,
  startHttpApi,
  type JobSink,
  type JobConfig,
  type JobStore,
  type Job,
  type NewEventsPayload,
  type ReportPayload,
  type ReportPayloadMeta,
  type User,
  type UserStore,
};

// A basic sink that logs to console; consumers (e.g., Discord bot) should implement their own sink.
export class ConsoleSink implements JobSink {
  handleNewEvents(payload: NewEventsPayload): void {
    const titles = payload.events.map((e) => `- ${e.title} (${e.startedAt})`).join('\n');
    // eslint-disable-next-line no-console
    console.log(`[job:${payload.jobId}] New events for channel ${payload.channelId}:\n${titles}`);
  }
  handleReport(payload: ReportPayload): void {
    // eslint-disable-next-line no-console
    console.log(`[job:${payload.jobId}] Report for channel ${payload.channelId}: ${payload.events.length} events (${payload.meta.range.from} .. ${payload.meta.range.to})`);
  }
}

// Helper to quickly bootstrap an in-process job runner (no HTTP), for embedding.
export function createInProcessRunner(opts: {
  apiKey: string;
  sink?: JobSink;
  store?: JobStore;
}) {
  const client = new ConnpassClient({ apiKey: opts.apiKey });
  const store = opts.store ?? new InMemoryJobStore();
  const sink = opts.sink ?? new ConsoleSink();
  const manager = new JobManager(client, store, sink);
  const scheduler = new JobScheduler(manager);
  return { client, manager, scheduler };
}

// Minimal HTTP server bootstrap (no external deps). Useful if you want to manage jobs over REST.
export function createHttpServer(opts: { apiKey: string; port?: number; sink?: JobSink; store?: JobStore }) {
  const { client, manager, scheduler } = createInProcessRunner({ apiKey: opts.apiKey, sink: opts.sink, store: opts.store });
  const server = startHttpApi(manager, scheduler, opts.port ?? 8787);
  return { client, manager, scheduler, server };
}
