export interface JobConfig {
  id: string; // unique per channel/job
  // Discord channel identifier (string to support threads/subchannels)
  channelId: string;
  // search filters
  keyword?: string[]; // AND search keywords
  keywordOr?: string[]; // OR search keywords
  // range in days from now (ymdFrom..ymdTo)
  rangeDays?: number; // default 14
  // prefecture filter (API-side)
  prefecture?: string[];
  // hashtag filter (client-side). compare to event.hashTag, case-insensitive; omit leading '#'
  hashTag?: string;
  // owner nickname filter (API-side)
  ownerNickname?: string;
  // sort order for API: 1=updated_at desc, 2=started_at asc, 3=started_at desc
  order?: 1 | 2 | 3;
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
