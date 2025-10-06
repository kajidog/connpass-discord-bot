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

  // --- report (AI summary) settings per channel ---
  // default toggle for using Mastra Agent API summarization when running /connpass report run
  reportAiDefault?: boolean;
  // free-form instruction template on how to summarize. Interpreted as system prompt supplement
  reportSummaryTemplate?: string;

  // --- scheduled report posting ---
  // whether to periodically generate and post a consolidated report
  reportEnabled?: boolean;
  // report posting interval in seconds (default daily if enabled)
  reportIntervalSec?: number;
  // search period for scheduled report (days from now; default 30)
  reportRangeDays?: number;

  // --- report-specific filters (optional). If omitted, feed filters are used ---
  reportKeyword?: string[];
  reportKeywordOr?: string[];
  reportPrefecture?: string[];
  reportHashTag?: string;
  reportOwnerNickname?: string;
  // sort order for report. If unspecified, uses feed order or default 2
  reportOrder?: 1 | 2 | 3;
}

export interface JobState {
  lastRunAt?: number;
  nextRunAt?: number; // 追加: 次回実行予定時刻（Unix timestamp, feed 用）
  lastEventUpdatedAt?: string; // ISO string of last seen event.updatedAt
  seenEventIds: Set<number>;
  // --- report scheduling state ---
  lastReportRunAt?: number;
  nextReportRunAt?: number; // 次回レポート実行予定時刻（Unix timestamp）
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
  handleReport?: (payload: ReportPayload) => Promise<void> | void;
}

export interface ReportPayloadMeta {
  range: { from: string; to: string };
  filters: {
    and: string[];
    or: string[];
    hashTag?: string;
    prefectures: string[];
    ownerNickname?: string;
    order: 'updated_desc' | 'started_asc' | 'started_desc';
  };
  ai: { enabled: boolean; template?: string };
}

export interface ReportPayload {
  jobId: string;
  channelId: string;
  events: import('@connpass-discord-bot/api-client').Event[];
  meta: ReportPayloadMeta;
}
