import type { IFeedStore } from '@connpass-discord-bot/core';
import { FileFeedStore, DrizzleFeedStore, createDatabase } from '@connpass-discord-bot/feed-worker';

export type StorageType = 'file' | 'sqlite';

const DEFAULT_JOB_STORE_DIR = './data';
const DEFAULT_STORAGE_TYPE: StorageType = 'file';

function normalizeStorageType(value: string | undefined): StorageType {
  if (!value) return DEFAULT_STORAGE_TYPE;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'sqlite') return 'sqlite';
  return 'file';
}

export function resolveStorageConfig(env: NodeJS.ProcessEnv = process.env): {
  storageType: StorageType;
  jobStoreDir: string;
  databaseUrl: string;
} {
  const storageType = normalizeStorageType(env.STORAGE_TYPE);
  const jobStoreDir = env.JOB_STORE_DIR || DEFAULT_JOB_STORE_DIR;
  const databaseUrl = env.DATABASE_URL || env.DB_PATH || `${jobStoreDir}/app.db`;

  return { storageType, jobStoreDir, databaseUrl };
}

export function createFeedStoreFromEnv(env: NodeJS.ProcessEnv = process.env): IFeedStore {
  const { storageType, jobStoreDir, databaseUrl } = resolveStorageConfig(env);

  if (storageType === 'sqlite') {
    const { db } = createDatabase(databaseUrl);
    return new DrizzleFeedStore(db);
  }

  return new FileFeedStore(jobStoreDir);
}
