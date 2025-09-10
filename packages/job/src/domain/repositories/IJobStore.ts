import { Job } from '../types';

export interface IJobStore {
  save(job: Job): Promise<void>;
  delete(jobId: string): Promise<void>;
  get(jobId: string): Promise<Job | undefined>;
  list(): Promise<Job[]>;
}
