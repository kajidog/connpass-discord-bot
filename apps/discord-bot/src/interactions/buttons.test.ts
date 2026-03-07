import { describe, it, expect, vi } from 'vitest';
import type { IChannelModelStore, IUserStore } from '@connpass-discord-bot/core';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import { handleButtonInteraction } from './buttons.js';

vi.mock('../embeds/detailEmbed.js', () => ({
  buildDetailEmbed: vi.fn(() => ({ title: 'detail' })),
}));

vi.mock('../agent/summarizer.js', () => ({
  summarizeEventDetails: vi.fn(async () => 'summary text'),
}));

vi.mock('../security/permissions.js', () => ({
  isBannedUser: vi.fn(async () => false),
}));

describe('button interaction thread channel resolution', () => {
  it('detail button in thread loads model config from parent channel', async () => {
    const client = {
      searchEvents: vi.fn(async () => ({
        events: [{
          id: 123,
          title: 'Event',
          description: 'desc',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          url: 'https://example.com',
        }],
      })),
    } as unknown as ConnpassClient;

    const userStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
    } as unknown as IUserStore;

    const channelModelStore: IChannelModelStore = {
      get: vi.fn(async () => null),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const interaction = {
      customId: 'ev:detail:123',
      channelId: 'thread-9',
      channel: {
        isThread: () => true,
        parentId: 'parent-9',
        send: vi.fn(),
      },
      message: {},
      user: { id: 'u1' },
      deferReply: vi.fn(),
      editReply: vi.fn(),
      reply: vi.fn(),
    };

    await handleButtonInteraction(
      interaction as never,
      client,
      userStore,
      undefined,
      channelModelStore,
      undefined
    );

    expect(channelModelStore.get).toHaveBeenCalledWith('parent-9');
  });
});
