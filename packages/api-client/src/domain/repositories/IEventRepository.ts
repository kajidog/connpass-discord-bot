import { EventSearchParams, EventsResponse, PresentationsResponse } from '../entities';

export interface IEventRepository {
  searchEvents(params: EventSearchParams): Promise<EventsResponse>;
  getEventPresentations(eventId: number): Promise<PresentationsResponse>;
}