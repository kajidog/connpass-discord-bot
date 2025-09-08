import { Job, JobStore } from '../domain/types';

export class InMemoryJobStore implements JobStore {
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

