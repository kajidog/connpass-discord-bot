import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IChannelModelStore, IBanStore } from '@connpass-discord-bot/core';
import { handleModelCommand } from './model.js';

vi.mock('../../ai/index.js', () => ({
  getAIConfig: vi.fn(() => ({
    agent: { provider: 'openai', model: 'gpt-4o-mini' },
    summarizer: { provider: 'openai', model: 'gpt-4o-mini' },
    allowedModels: {
      openai: ['gpt-4o-mini'],
      anthropic: ['claude-sonnet-4-5'],
      google: ['gemini-2.0-flash'],
    },
  })),
  validateModel: vi.fn(() => true),
}));

vi.mock('../../security/permissions.js', () => ({
  isBannedUser: vi.fn(async () => false),
}));

describe('model handler thread channel resolution', () => {
  let channelModelStore: IChannelModelStore;
  let banStore: IBanStore;

  beforeEach(() => {
    channelModelStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };

    banStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
    };
  });

  it('set in thread saves config under parent channel id', async () => {
    vi.mocked(channelModelStore.get).mockResolvedValue(null);

    const interaction = {
      channelId: 'thread-1',
      channel: {
        isThread: () => true,
        parentId: 'parent-1',
      },
      user: { id: 'u1' },
      options: {
        getSubcommand: () => 'set',
        getString: (name: string) => {
          if (name === 'type') return 'agent';
          if (name === 'provider') return 'openai';
          if (name === 'model') return 'gpt-4o-mini';
          return null;
        },
      },
      reply: vi.fn(),
    };

    await handleModelCommand(interaction as never, channelModelStore, banStore);

    expect(channelModelStore.get).toHaveBeenCalledWith('parent-1');
    expect(channelModelStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'parent-1' })
    );
  });

  it('status in thread reads config from parent channel id', async () => {
    vi.mocked(channelModelStore.get).mockResolvedValue(null);

    const interaction = {
      channelId: 'thread-2',
      channel: {
        isThread: () => true,
        parentId: 'parent-2',
      },
      user: { id: 'u1' },
      options: {
        getSubcommand: () => 'status',
      },
      reply: vi.fn(),
    };

    await handleModelCommand(interaction as never, channelModelStore, banStore);

    expect(channelModelStore.get).toHaveBeenCalledWith('parent-2');
  });
});
