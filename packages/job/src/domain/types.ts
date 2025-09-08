export type KeywordMode = 'and' | 'or';

export interface JobConfig {
  id: string; // unique per channel/job
  // Discord channel identifier (string to support threads/subchannels)
  channelId: string;
  // search filters
  keyword?: string[]; // used when mode === 'and'
  keywordOr?: string[]; // used when mode === 'or'
  mode: KeywordMode;
  // range in days from now (ymdFrom..ymdTo)
  rangeDays?: number; // default 14
  // location/address substring match (handled client-side)
  location?: string;
  // poll interval in seconds
  intervalSec: number; // default 1800 (30m)
}

export interface JobState {
  lastRunAt?: number;
  lastEventUpdatedAt?: string; // ISO string of last seen event.updatedAt
  seenEventIds: Set<number>;
}

export interface Job extends JobConfig {
  state: JobState;
}

export interface NewEventsPayload {
  jobId: string;
  channelId: string;
  events: import('@connpass-discord-bot/api-client').Event[];
}

export interface JobSink {
  handleNewEvents: (payload: NewEventsPayload) => Promise<void> | void;
}

export interface JobStore {
  save(job: Job): Promise<void>;
  delete(jobId: string): Promise<void>;
  get(jobId: string): Promise<Job | undefined>;
  list(): Promise<Job[]>;
}

