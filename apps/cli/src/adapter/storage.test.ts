import { describe, it, expect } from 'vitest';
import { resolveStorageConfig } from './storage.js';

describe('resolveStorageConfig', () => {
  it('returns defaults when env is empty', () => {
    const config = resolveStorageConfig({});
    expect(config.storageType).toBe('file');
    expect(config.jobStoreDir).toBe('./data');
    expect(config.databaseUrl).toBe('./data/app.db');
  });

  it('uses sqlite and database url from env', () => {
    const config = resolveStorageConfig({
      STORAGE_TYPE: 'sqlite',
      JOB_STORE_DIR: '/tmp/connpass',
      DATABASE_URL: '/tmp/connpass/app.db',
    });
    expect(config.storageType).toBe('sqlite');
    expect(config.jobStoreDir).toBe('/tmp/connpass');
    expect(config.databaseUrl).toBe('/tmp/connpass/app.db');
  });

  it('prefers DATABASE_URL over DB_PATH', () => {
    const config = resolveStorageConfig({
      STORAGE_TYPE: 'sqlite',
      DATABASE_URL: '/tmp/primary.db',
      DB_PATH: '/tmp/legacy.db',
    });
    expect(config.databaseUrl).toBe('/tmp/primary.db');
  });
});
