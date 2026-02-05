import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFeedStore } from './InMemoryFeedStore.js';
import type { Feed } from '@connpass-discord-bot/core';

function createFeed(id: string): Feed {
  return {
    config: {
      id,
      channelId: `channel-${id}`,
      schedule: '0 9 * * *',
      rangeDays: 14,
    },
    state: {
      sentEvents: {},
    },
  };
}

describe('InMemoryFeedStore', () => {
  let store: InMemoryFeedStore;

  beforeEach(() => {
    store = new InMemoryFeedStore();
  });

  describe('save / get', () => {
    it('フィードを保存して取得できる', async () => {
      const feed = createFeed('f1');
      await store.save(feed);

      const result = await store.get('f1');

      expect(result).toBeDefined();
      expect(result!.config.id).toBe('f1');
      expect(result!.config.schedule).toBe('0 9 * * *');
    });

    it('取得結果はコピーなので元データに影響しない', async () => {
      const feed = createFeed('f1');
      await store.save(feed);

      const result = await store.get('f1');
      result!.config.schedule = 'modified';

      const result2 = await store.get('f1');
      expect(result2!.config.schedule).toBe('0 9 * * *');
    });

    it('保存時もコピーされるので元データの変更は影響しない', async () => {
      const feed = createFeed('f1');
      await store.save(feed);

      feed.config.schedule = 'modified';

      const result = await store.get('f1');
      expect(result!.config.schedule).toBe('0 9 * * *');
    });

    it('既存フィードを上書き保存できる', async () => {
      await store.save(createFeed('f1'));

      const updated = createFeed('f1');
      updated.config.schedule = '0 12 * * *';
      await store.save(updated);

      const result = await store.get('f1');
      expect(result!.config.schedule).toBe('0 12 * * *');
    });

    it('存在しないフィードはundefinedを返す', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('フィードを削除できる', async () => {
      await store.save(createFeed('f1'));
      await store.delete('f1');

      const result = await store.get('f1');
      expect(result).toBeUndefined();
    });

    it('存在しないフィードの削除はエラーにならない', async () => {
      await expect(store.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('全フィードを取得できる', async () => {
      await store.save(createFeed('f1'));
      await store.save(createFeed('f2'));
      await store.save(createFeed('f3'));

      const feeds = await store.list();
      expect(feeds).toHaveLength(3);
    });

    it('空の場合は空配列を返す', async () => {
      const feeds = await store.list();
      expect(feeds).toEqual([]);
    });

    it('リスト結果もコピーなので変更は影響しない', async () => {
      await store.save(createFeed('f1'));

      const feeds = await store.list();
      feeds[0].config.schedule = 'modified';

      const feeds2 = await store.list();
      expect(feeds2[0].config.schedule).toBe('0 9 * * *');
    });
  });
});
