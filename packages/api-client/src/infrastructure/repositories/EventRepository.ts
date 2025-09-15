import { IEventRepository } from '../../domain/repositories';
import { Event, EventSearchParams, EventsResponse, PresentationsResponse } from '../../domain/entities';
import { HttpClient } from '../http/HttpClient';
import { Validators } from '../../domain/utils/validators';

export class EventRepository implements IEventRepository {
  constructor(private httpClient: HttpClient) {}

  async searchEvents(params: EventSearchParams): Promise<EventsResponse> {
    Validators.validateEventSearchParams(params);
    const queryParams = this.buildEventQueryParams(params);
    const response = await this.httpClient.get<any>('/events/', queryParams);
    return this.mapEventsResponse(response.data);
  }

  async getEventPresentations(eventId: number): Promise<PresentationsResponse> {
    Validators.validatePositiveInteger(eventId, 'eventId');
    const response = await this.httpClient.get<PresentationsResponse>(`/events/${eventId}/presentations/`);
    return response.data;
  }

  private buildEventQueryParams(params: EventSearchParams): Record<string, any> {
    const queryParams: Record<string, any> = {};

    if (params.eventId) queryParams.event_id = params.eventId;
    if (params.keyword) queryParams.keyword = params.keyword;
    if (params.keywordOr) queryParams.keyword_or = params.keywordOr;
    if (params.ymd) queryParams.ymd = params.ymd.join(',');
    // For v2 compatibility: expand ymdFrom..ymdTo into comma-separated ymd list, while still passing v1 params
    if (params.ymdFrom) queryParams.ymd_from = params.ymdFrom;
    if (params.ymdTo) queryParams.ymd_to = params.ymdTo;
    if (params.ymdFrom || params.ymdTo) {
      const from = params.ymdFrom ? new Date(params.ymdFrom) : undefined;
      const to = params.ymdTo ? new Date(params.ymdTo) : undefined;
      if (from && !Number.isNaN(from.getTime())) {
        const end = to && !Number.isNaN(to.getTime()) ? to : from;
        const list: string[] = [];
        const cur = new Date(from);
        // normalize to local date, increment by 1 day
        // cap at 366 iterations to avoid runaway
        let guard = 0;
        while (cur <= end && guard < 366) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          list.push(`${y}${m}${d}`);
          cur.setDate(cur.getDate() + 1);
          guard += 1;
        }
        if (list.length) {
          queryParams.ymd = list.join(',');
        }
      }
    }
    if (params.nickname) queryParams.nickname = params.nickname;
    if (params.ownerNickname) queryParams.owner_nickname = params.ownerNickname;
    if (params.groupId) queryParams.group_id = params.groupId;
    if (params.prefecture) queryParams.prefecture = params.prefecture;
    if (params.count) queryParams.count = params.count;
    if (params.order) queryParams.order = params.order;
    if (params.start) queryParams.start = params.start;

    return queryParams;
  }

  private mapEventsResponse(data: any): EventsResponse {
    // Accept both v1-like snake_case and v2-like camelCase
    const eventsArray: any[] = data.events ?? data.event ?? [];

    const events: Event[] = eventsArray.map((e: any) => ({
      id: e.id ?? e.event_id,
      title: e.title,
      catchPhrase: e.catch ?? e.catchPhrase ?? '',
      description: e.description ?? '',
      url: e.url ?? e.event_url,
      hashTag: e.hash_tag ?? e.hashTag ?? '',
      startedAt: e.started_at ?? e.startedAt ?? '',
      endedAt: e.ended_at ?? e.endedAt ?? '',
      limit: e.limit ?? undefined,
      participantCount: e.accepted ?? e.participantCount ?? 0,
      waitingCount: e.waiting ?? e.waitingCount ?? 0,
      ownerNickname: e.owner_nickname ?? e.ownerNickname ?? '',
      ownerDisplayName: e.owner_display_name ?? e.ownerDisplayName ?? '',
      place: e.place ?? undefined,
      address: e.address ?? undefined,
      lat: e.lat ?? undefined,
      lon: e.lon ?? undefined,
      groupId: (e.group?.id ?? e.series?.id) ?? undefined,
      groupTitle: (e.group?.title ?? e.series?.title) ?? undefined,
      groupUrl: (e.group?.url ?? e.series?.url) ?? undefined,
      updatedAt: e.updated_at ?? e.updatedAt ?? '',
    }));

    return {
      eventsReturned: data.results_returned ?? data.eventsReturned ?? events.length,
      eventsAvailable: data.results_available ?? data.eventsAvailable ?? events.length,
      eventsStart: data.results_start ?? data.eventsStart ?? 1,
      events,
    };
  }
}
