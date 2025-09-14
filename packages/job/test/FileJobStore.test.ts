import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileJobStore } from '../src/infrastructure/FileJobStore';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { Job } from '../src/domain/types';

function sampleJob(id: string): Job {
  return {
    id,
    channelId: id,
    keywordOr: ['TS', 'Node'],
    intervalSec: 300,
    rangeDays: 14,
    state: { lastRunAt: undefined, lastEventUpdatedAt: undefined, seenEventIds: new Set([1, 2, 3]) },
  };
}

describe('FileJobStore', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobstore-'));
  });

  afterEach(async () => {
    // clean up
    try {
      const files = await fs.readdir(tmpDir);
      await Promise.all(files.map((f) => fs.unlink(path.join(tmpDir, f))));
      await fs.rmdir(tmpDir);
    } catch {
      // ignore
    }
  });

  it('saves and retrieves a job with Set state', async () => {
    const store = new FileJobStore(tmpDir);
    const job = sampleJob('channel-1');
    await store.save(job);

    // new instance simulates restart
    const store2 = new FileJobStore(tmpDir);
    const loaded = await store2.get('channel-1');
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(job.id);
    expect(loaded!.state.seenEventIds instanceof Set).toBe(true);
    expect(Array.from(loaded!.state.seenEventIds)).toEqual([1, 2, 3]);
  });

  it('lists multiple jobs', async () => {
    const store = new FileJobStore(tmpDir);
    await store.save(sampleJob('a'));
    await store.save(sampleJob('b'));

    const all = await store.list();
    const ids = all.map((j) => j.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('deletes a job file', async () => {
    const store = new FileJobStore(tmpDir);
    await store.save(sampleJob('delme'));
    expect((await store.get('delme'))).toBeDefined();
    await store.delete('delme');
    expect((await store.get('delme'))).toBeUndefined();
  });

  it('skips invalid JSON files on list/get', async () => {
    const p = path.join(tmpDir, 'invalid.json');
    await fs.writeFile(p, '{not-json', 'utf8');
    const store = new FileJobStore(tmpDir);
    const list = await store.list();
    expect(list).toEqual([]);
    const one = await store.get('invalid');
    expect(one).toBeUndefined();
  });
});
