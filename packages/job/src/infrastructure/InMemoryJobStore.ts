import { Job } from '../domain/types';
import { IJobStore } from '../domain/repositories/IJobStore';

export class InMemoryJobStore implements IJobStore {
  private store = new Map<string, Job>();

  async save(job: Job): Promise<void> {
    this.store.set(job.id, job);
  }

  async delete(jobId: string): Promise<void> {
    this.store.delete(jobId);
  }

  async get(jobId: string): Promise<Job | undefined> {
    return this.store.get(jobId);
  }

  async list(): Promise<Job[]> {
    return Array.from(this.store.values());
  }
}

