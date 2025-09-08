import { IEventRepository } from '../../domain/repositories';
import { EventSearchParams, EventsResponse, PresentationsResponse } from '../../domain/entities';
import { HttpClient } from '../http/HttpClient';
import { Validators } from '../../domain/utils/validators';

export class EventRepository implements IEventRepository {
  constructor(private httpClient: HttpClient) {}

  async searchEvents(params: EventSearchParams): Promise<EventsResponse> {
    Validators.validateEventSearchParams(params);
    const queryParams = this.buildEventQueryParams(params);
    const response = await this.httpClient.get<EventsResponse>('/events/', queryParams);
    return response.data;
  }

  async getEventPresentations(eventId: number): Promise<PresentationsResponse> {
    Validators.validatePositiveInteger(eventId, 'eventId');
    const response = await this.httpClient.get<PresentationsResponse>(`/events/${eventId}/presentations/`);
    return response.data;
  }

  private buildEventQueryParams(params: EventSearchParams): Record<string, any> {
    const queryParams: Record<string, any> = {};

    if (params.eventId) queryParams.event_id = params.eventId.join(',');
    if (params.keyword) queryParams.keyword = params.keyword;
    if (params.keywordOr) queryParams.keyword_or = params.keywordOr;
    if (params.ymdFrom) queryParams.ymd_from = params.ymdFrom;
    if (params.ymdTo) queryParams.ymd_to = params.ymdTo;
    if (params.nickname) queryParams.nickname = params.nickname;
    if (params.ownerNickname) queryParams.owner_nickname = params.ownerNickname;
    if (params.groupId) queryParams.group_id = params.groupId.join(',');
    if (params.count) queryParams.count = params.count;
    if (params.order) queryParams.order = params.order;
    if (params.start) queryParams.start = params.start;

    return queryParams;
  }
}