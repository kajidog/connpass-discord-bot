export interface Event {
  id: number;
  title: string;
  catchPhrase: string;
  description: string;
  url: string;
  hashTag: string;
  startedAt: string;
  endedAt: string;
  limit?: number;
  participantCount: number;
  waitingCount: number;
  ownerNickname: string;
  ownerDisplayName: string;
  place?: string;
  address?: string;
  lat?: number;
  lon?: number;
  groupId?: number;
  groupTitle?: string;
  groupUrl?: string;
  updatedAt: string;
}

export interface EventSearchParams {
  eventId?: number[];
  keyword?: string;
  keywordOr?: string;
  ymd?: string[];
  ymdFrom?: string;
  ymdTo?: string;
  nickname?: string;
  ownerNickname?: string;
  groupId?: number[];
  prefecture?: string[];
  count?: number;
  order?: 1 | 2 | 3;
  start?: number;
}

export interface EventsResponse {
  eventsReturned: number;
  eventsAvailable: number;
  eventsStart: number;
  events: Event[];
}