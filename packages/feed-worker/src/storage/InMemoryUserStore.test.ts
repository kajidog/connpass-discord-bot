import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryUserStore } from './InMemoryUserStore.js';
import type { User } from '@connpass-discord-bot/core';

function createUser(id: string): User {
  return {
    discordUserId: id,
    connpassNickname: `user-${id}`,
    registeredAt: new Date().toISOString(),
  };
}

describe('InMemoryUserStore', () => {
  let store: InMemoryUserStore;

  beforeEach(() => {
    store = new InMemoryUserStore();
  });

  describe('save / find', () => {
    it('ユーザーを保存して取得できる', async () => {
      const user = createUser('u1');
      await store.save(user);

      const result = await store.find('u1');

      expect(result).toBeDefined();
      expect(result!.discordUserId).toBe('u1');
      expect(result!.connpassNickname).toBe('user-u1');
    });

    it('取得結果はコピーなので元データに影響しない', async () => {
      await store.save(createUser('u1'));

      const result = await store.find('u1');
      result!.connpassNickname = 'modified';

      const result2 = await store.find('u1');
      expect(result2!.connpassNickname).toBe('user-u1');
    });

    it('既存ユーザーを上書き保存できる', async () => {
      await store.save(createUser('u1'));

      const updated = createUser('u1');
      updated.connpassNickname = 'new-nickname';
      await store.save(updated);

      const result = await store.find('u1');
      expect(result!.connpassNickname).toBe('new-nickname');
    });

    it('存在しないユーザーはundefinedを返す', async () => {
      const result = await store.find('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('ユーザーを削除できる', async () => {
      await store.save(createUser('u1'));
      await store.delete('u1');

      const result = await store.find('u1');
      expect(result).toBeUndefined();
    });

    it('存在しないユーザーの削除はエラーにならない', async () => {
      await expect(store.delete('nonexistent')).resolves.not.toThrow();
    });
  });
});
