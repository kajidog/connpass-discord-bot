import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryJobStore } from '../src/infrastructure/InMemoryJobStore';
import { JobManager } from '../src/application/JobManager';
import { JobScheduler } from '../src/application/JobScheduler';
import type { ConnpassClient } from '@connpass-discord-bot/api-client';

describe('JobScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs immediately and then on intervals', async () => {
    const store = new InMemoryJobStore();
    const sink = { handleNewEvents: vi.fn() };
    const client = { searchEvents: vi.fn().mockResolvedValue({ eventsReturned: 0, eventsAvailable: 0, eventsStart: 1, events: [] }) } as unknown as ConnpassClient;
    const manager = new JobManager(client, store, sink);
    const scheduler = new JobScheduler(manager);

    await manager.upsert({ id: 'sch-1', channelId: 'ch', mode: 'or', keywordOr: ['TS'], intervalSec: 10 });

    const runOnceSpy = vi.spyOn(manager, 'runOnce').mockResolvedValue({ eventsReturned: 0, eventsAvailable: 0, eventsStart: 1, events: [] });

    await scheduler.start('sch-1');

    // immediate call
    expect(runOnceSpy).toHaveBeenCalledTimes(1);

    // advance one interval
    vi.advanceTimersByTime(10_000);
    expect(runOnceSpy).toHaveBeenCalledTimes(2);

    // advance again
    vi.advanceTimersByTime(10_000);
    expect(runOnceSpy).toHaveBeenCalledTimes(3);
  });
});

