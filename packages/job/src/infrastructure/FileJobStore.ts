import { promises as fs } from 'fs';
import path from 'path';
import { Job, JobStore } from '../domain/types';

interface PersistedJob extends Omit<Job, 'state'> {
  schemaVersion: 1;
  updatedAt: string;
  state: {
    lastRunAt?: number;
    lastEventUpdatedAt?: string;
    seenEventIds: number[];
  };
}

function toPersisted(job: Job): PersistedJob {
  return {
    ...job,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    state: {
      lastRunAt: job.state.lastRunAt,
      lastEventUpdatedAt: job.state.lastEventUpdatedAt,
      seenEventIds: Array.from(job.state.seenEventIds || []),
    },
  } as PersistedJob;
}

function fromPersisted(p: PersistedJob): Job {
  return {
    ...p,
    state: {
      lastRunAt: p.state.lastRunAt,
      lastEventUpdatedAt: p.state.lastEventUpdatedAt,
      seenEventIds: new Set(p.state.seenEventIds || []),
    },
  } as Job;
}

function idToFilename(id: string): string {
  // use encodeURIComponent to keep cross-platform safe names
  return `${encodeURIComponent(id)}.json`;
}

export class FileJobStore implements JobStore {
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

