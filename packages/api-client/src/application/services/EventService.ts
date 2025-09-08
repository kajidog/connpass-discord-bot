import { IEventRepository } from '../../domain/repositories';
import { EventSearchParams, EventsResponse, PresentationsResponse } from '../../domain/entities';

export class EventService {
  constructor(private eventRepository: IEventRepository) {}

  async searchEvents(params: EventSearchParams = {}): Promise<EventsResponse> {
    return this.eventRepository.searchEvents(params);
  }

  async getEventPresentations(eventId: number): Promise<PresentationsResponse> {
    if (eventId <= 0) {
      throw new Error('Event ID must be a positive number');
    }
    return this.eventRepository.getEventPresentations(eventId);
  }

  async getAllEvents(params: Omit<EventSearchParams, 'start' | 'count'> = {}): Promise<EventsResponse> {
    const allEvents: EventsResponse = {
      eventsReturned: 0,
      eventsAvailable: 0,
      eventsStart: 1,
      events: [],
    };

    let start = 1;
    const count = 100;

    while (true) {
      const response = await this.searchEvents({ ...params, start, count });
      
      if (allEvents.eventsAvailable === 0) {
        allEvents.eventsAvailable = response.eventsAvailable;
        allEvents.eventsStart = response.eventsStart;
      }
      
      allEvents.events.push(...response.events);
      allEvents.eventsReturned += response.eventsReturned;

      if (response.eventsReturned < count || allEvents.events.length >= response.eventsAvailable) {
        break;
      }

      start += count;
    }

    return allEvents;
  }
}