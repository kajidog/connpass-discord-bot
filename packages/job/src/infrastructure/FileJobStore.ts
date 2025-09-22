import { promises as fs } from 'fs';
import path from 'path';
import { Job } from '../domain/types';
import { IJobStore } from '../domain/repositories/IJobStore';

interface PersistedJob extends Omit<Job, 'state'> {
  schemaVersion: 2; // バージョンを2に更新
  updatedAt: string;
  state: {
    lastRunAt?: number;
    nextRunAt?: number; // 追加
    lastEventUpdatedAt?: string;
    seenEventIds: number[];
  };
}

import { JobState } from '../domain/types';

function toPersisted(job: Job): PersistedJob {
  return {
    ...job,
    schemaVersion: 2, // 更新
    updatedAt: new Date().toISOString(),
    state: {
      lastRunAt: job.state.lastRunAt,
      nextRunAt: job.state.nextRunAt, // 追加
      lastEventUpdatedAt: job.state.lastEventUpdatedAt,
      seenEventIds: Array.from(job.state.seenEventIds || []),
    },
  } as PersistedJob;
}

function fromPersisted(p: PersistedJob): Job {
  // 後方互換性: schemaVersion 1 のデータも読み込み可能
  const state: JobState = {
    lastRunAt: p.state.lastRunAt,
    lastEventUpdatedAt: p.state.lastEventUpdatedAt,
    seenEventIds: new Set(p.state.seenEventIds || []),
  };

  // schemaVersion 2 以上の場合のみ nextRunAt を設定
  if (p.schemaVersion >= 2) {
    state.nextRunAt = (p.state as any).nextRunAt;
  }

  return {
    ...p,
    state,
  } as Job;
}

function idToFilename(id: string): string {
  // use encodeURIComponent to keep cross-platform safe names
  return `${encodeURIComponent(id)}.json`;
}

export class FileJobStore implements IJobStore {
  constructor(private readonly dir: string) {}

  private async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private filePath(jobId: string) {
    return path.join(this.dir, idToFilename(jobId));
  }

  async save(job: Job): Promise<void> {
    await this.ensureDir();
    const file = this.filePath(job.id);
    const tmp = `${file}.tmp`;
    const data = JSON.stringify(toPersisted(job), null, 2);
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, file);
  }

  async delete(jobId: string): Promise<void> {
    const file = this.filePath(jobId);
    try {
      await fs.unlink(file);
    } catch (e: any) {
      if (e?.code === 'ENOENT') return; // ignore
      throw e;
    }
  }

  async get(jobId: string): Promise<Job | undefined> {
    const file = this.filePath(jobId);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const data = JSON.parse(raw) as PersistedJob;
      return fromPersisted(data);
    } catch (e: any) {
      if (e?.code === 'ENOENT') return undefined;
      // malformed JSON etc. treat as not found rather than crashing the process
      return undefined;
    }
  }

  async list(): Promise<Job[]> {
    await this.ensureDir();
    const files = await fs.readdir(this.dir);
    const out: Job[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(this.dir, f);
      try {
        const raw = await fs.readFile(p, 'utf8');
        const data = JSON.parse(raw) as PersistedJob;
        out.push(fromPersisted(data));
      } catch {
        // skip invalid entries
      }
    }
    return out;
  }
}

