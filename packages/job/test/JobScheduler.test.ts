import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryJobStore } from '../src/infrastructure/InMemoryJobStore';
import { JobManager } from '../src/application/JobManager';
import { JobScheduler } from '../src/application/JobScheduler';
import type { ConnpassClient } from '@connpass-discord-bot/api-client';
import { Job } from '../src/domain/types';

describe('JobScheduler', () => {
  let store: InMemoryJobStore;
  let manager: JobManager;
  let client: ConnpassClient;
  const sink = { handleNewEvents: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryJobStore();
    client = { searchEvents: vi.fn().mockResolvedValue({ eventsReturned: 0, eventsAvailable: 0, eventsStart: 1, events: [] }) } as unknown as ConnpassClient;
    manager = new JobManager(client, store, sink);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('interval mode', () => {
    it('schedules on intervals only (no immediate run)', async () => {
      const scheduler = new JobScheduler(manager, { mode: 'interval' });
      await manager.upsert({ id: 'sch-1', channelId: 'ch', keywordOr: ['TS'], intervalSec: 10 });
      const runOnceSpy = vi.spyOn(manager, 'runOnce');

      await scheduler.start('sch-1');

      expect(runOnceSpy).toHaveBeenCalledTimes(0);
      vi.advanceTimersByTime(10_000);
      expect(runOnceSpy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(10_000);
      expect(runOnceSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('scheduled mode', () => {
    it('should execute job immediately if nextRunAt is not set', async () => {
      const scheduler = new JobScheduler(manager, { mode: 'scheduled' });
      await manager.upsert({ id: 'sch-1', channelId: 'ch', keywordOr: ['TS'], intervalSec: 10 });
      const runOnceSpy = vi.spyOn(manager, 'runOnce');

      await scheduler.start('sch-1');
      await vi.advanceTimersByTimeAsync(1000); // For setTimeout

      expect(runOnceSpy).toHaveBeenCalledTimes(1);
      const job = await manager.get('sch-1');
      expect(job?.state.nextRunAt).toBeGreaterThan(Date.now());
    });

    it('should not execute job immediately if nextRunAt is in the future', async () => {
      const scheduler = new JobScheduler(manager, { mode: 'scheduled' });
      const futureTime = Date.now() + 20000;
      const jobData: Job = {
        id: 'sch-1',
        channelId: 'ch',
        keywordOr: ['TS'],
        intervalSec: 10,
        state: { nextRunAt: futureTime, seenEventIds: new Set() },
      };
      await store.save(jobData);
      const runOnceSpy = vi.spyOn(manager, 'runOnce');

      await scheduler.start('sch-1');
      await vi.advanceTimersByTimeAsync(1000);

      expect(runOnceSpy).toHaveBeenCalledTimes(0);
    });

    it('should execute job when checkAndExecuteJobs is called and time is due', async () => {
      const scheduler = new JobScheduler(manager, { mode: 'scheduled' });
      const pastTime = Date.now() - 1000;
      const jobData: Job = {
        id: 'sch-1',
        channelId: 'ch',
        keywordOr: ['TS'],
        intervalSec: 10,
        state: { nextRunAt: pastTime, seenEventIds: new Set() },
      };
      await store.save(jobData);
      const runOnceSpy = vi.spyOn(manager, 'runOnce');

      // Manually trigger the check
      // @ts-ignore private method
      await scheduler.checkAndExecuteJobs();
      await vi.advanceTimersByTimeAsync(1000);

      expect(runOnceSpy).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple jobs with a delay', async () => {
      const scheduler = new JobScheduler(manager, { mode: 'scheduled' });
      await manager.upsert({ id: 'sch-1', channelId: 'ch', intervalSec: 10 });
      await manager.upsert({ id: 'sch-2', channelId: 'ch', intervalSec: 10 });
      const runOnceSpy = vi.spyOn(manager, 'runOnce');

      await scheduler.startAll();
      await vi.advanceTimersByTimeAsync(3000);

      expect(runOnceSpy).toHaveBeenCalledTimes(2);
    });
  });
});
