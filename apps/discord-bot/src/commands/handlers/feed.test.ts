import { describe, it, expect, vi } from 'vitest';
import type { IFeedStore, IBanStore } from '@connpass-discord-bot/core';
import type { FeedExecutor } from '@connpass-discord-bot/feed-worker';
import { handleFeedRun } from './feed.js';

vi.mock('../../security/permissions.js', () => ({
  isBannedUser: vi.fn(async () => false),
}));

describe('feed handler thread channel resolution', () => {
  it('feed run in thread resolves parent channel feed', async () => {
    const store: IFeedStore = {
      save: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(async (id: string) => {
        if (id !== 'parent-feed') return undefined;
        return {
          config: {
            id: 'parent-feed',
            channelId: 'parent-feed',
            schedule: '0 9 * * *',
            rangeDays: 14,
          },
          state: { sentEvents: {} },
        };
      }),
      list: vi.fn(async () => []),
    };

    const executor = {
      execute: vi.fn(async () => ({ feedId: 'parent-feed', total: 1, newCount: 0 })),
    } as unknown as FeedExecutor;

    const banStore: IBanStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
    };

    const interaction = {
      channelId: 'thread-feed',
      channel: {
        isThread: () => true,
        parentId: 'parent-feed',
      },
      user: { id: 'u1' },
      reply: vi.fn(),
      deferReply: vi.fn(),
      editReply: vi.fn(),
    };

    await handleFeedRun(interaction as never, store, executor, banStore);

    expect(store.get).toHaveBeenCalledWith('parent-feed');
    expect(executor.execute).toHaveBeenCalledWith('parent-feed');
  });
});
