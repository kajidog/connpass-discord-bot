import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileUserStore } from '../src/infrastructure/FileUserStore';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { User } from '../src/domain/User';

describe('FileUserStore', () => {
  let tmpDir: string;
  let store: FileUserStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'userstore-'));
    store = new FileUserStore(tmpDir);
  });

  afterEach(async () => {
    try {
      const files = await fs.readdir(tmpDir);
      await Promise.all(files.map((f) => fs.unlink(path.join(tmpDir, f))));
      await fs.rmdir(tmpDir);
    } catch {
      // ignore
    }
  });

  it('should save and find a user', async () => {
    const user: User = { discordUserId: '123', connpassNickname: 'testuser' };
    await store.save(user);

    const foundUser = await store.find('123');
    expect(foundUser).toEqual(user);
  });

  it('should return undefined for a non-existent user', async () => {
    const foundUser = await store.find('nonexistent');
    expect(foundUser).toBeUndefined();
  });

  it('should update an existing user', async () => {
    const user1: User = { discordUserId: '123', connpassNickname: 'testuser1' };
    await store.save(user1);
    const user2: User = { discordUserId: '123', connpassNickname: 'testuser2' };
    await store.save(user2);

    const foundUser = await store.find('123');
    expect(foundUser).toEqual(user2);
  });

  it('should delete a user', async () => {
    const user: User = { discordUserId: '123', connpassNickname: 'testuser' };
    await store.save(user);
    await store.delete('123');

    const foundUser = await store.find('123');
    expect(foundUser).toBeUndefined();
  });
});
