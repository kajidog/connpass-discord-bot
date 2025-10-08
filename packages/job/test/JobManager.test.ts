import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryJobStore } from '../src/infrastructure/InMemoryJobStore';
import { JobManager } from '../src/application/JobManager';
import type { JobSink } from '../src/domain/types';
import type { ConnpassClient, Event } from '@kajidog/connpass-api-client';

class CollectSink implements JobSink {
  public payloads: any[] = [];
  handleNewEvents(payload: any): void {
    this.payloads.push(payload);
  }
}

function makeEvent(id: number, title: string, startedAt: string, updatedAt: string, place?: string, address?: string): Event {
  return {
    id,
    title,
    catchPhrase: '',
    description: '',
    url: 'https://example.com',
    hashTag: '',
    startedAt,
    endedAt: startedAt,
    participantCount: 0,
    waitingCount: 0,
    ownerNickname: 'owner',
    ownerDisplayName: 'Owner',
    place,
    address,
    updatedAt,
  } as unknown as Event;
}

describe('JobManager', () => {
  let store: InMemoryJobStore;
  let sink: CollectSink;
  let client: ConnpassClient;
  let manager: JobManager;

  beforeEach(() => {
    store = new InMemoryJobStore();
    sink = new CollectSink();
    client = {
      // @ts-expect-error only stub what we use
      searchEvents: vi.fn(),
    } as unknown as ConnpassClient;
    manager = new JobManager(client, store, sink);
  });

  it('notifies only new events and updates state', async () => {
    const now = new Date();
    const iso = now.toISOString();
    const evs = [
      makeEvent(1, 'Event A', iso, iso),
      makeEvent(2, 'Event B', iso, iso),
    ];
    (client.searchEvents as any).mockResolvedValue({ eventsReturned: evs.length, eventsAvailable: evs.length, eventsStart: 1, events: evs });

    await manager.upsert({ id: 'job-1', channelId: 'ch1', intervalSec: 60, keywordOr: ['TS'] });

    const res1 = await manager.runOnce('job-1');
    expect(res1.events).toHaveLength(2);
    expect(sink.payloads).toHaveLength(1);
    expect(sink.payloads[0].events).toHaveLength(2);

    const res2 = await manager.runOnce('job-1');
    expect(res2.events).toHaveLength(2);
    // no additional notifications as nothing new
    expect(sink.payloads).toHaveLength(1);
  });

  it('passes prefecture filter to API client', async () => {
    const iso = new Date().toISOString();
    const evs = [
      makeEvent(10, 'Tokyo Event', iso, iso, 'Tokyo', 'Shinjuku'),
    ];
    (client.searchEvents as any).mockResolvedValue({ eventsReturned: evs.length, eventsAvailable: evs.length, eventsStart: 1, events: evs });

    await manager.upsert({ id: 'job-2', channelId: 'ch2', intervalSec: 60, keywordOr: ['JS'], prefecture: ['tokyo'] });
    await manager.runOnce('job-2');

    expect(client.searchEvents).toHaveBeenCalledWith(expect.objectContaining({
      prefecture: ['tokyo'],
    }));
  });

  it('treats events updated later as new even if seen by id earlier', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 60_000).toISOString();
    const later = now.toISOString();

    // first run: event with earlier updatedAt
    (client.searchEvents as any).mockResolvedValueOnce({
      eventsReturned: 1,
      eventsAvailable: 1,
      eventsStart: 1,
      events: [makeEvent(100, 'Updatable', later, earlier)],
    });

    await manager.upsert({ id: 'job-3', channelId: 'ch3', intervalSec: 60, keywordOr: ['Node'] });
    await manager.runOnce('job-3');
    expect(sink.payloads.at(-1).events).toHaveLength(1);

    // second run: same id but updatedAt later -> should notify again
    (client.searchEvents as any).mockResolvedValueOnce({
      eventsReturned: 1,
      eventsAvailable: 1,
      eventsStart: 1,
      events: [makeEvent(100, 'Updatable', later, new Date(now.getTime() + 60_000).toISOString())],
    });

    await manager.runOnce('job-3');
    expect(sink.payloads.at(-1).events).toHaveLength(1);
  });
});
