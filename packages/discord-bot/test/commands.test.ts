import { describe, it, expect, vi } from 'vitest';
import { handleCommand } from '../src/commands';
import type { ChatInputCommandInteraction, CacheType } from 'discord.js';
import type { JobManager, JobScheduler } from '@connpass-discord-bot/job';

describe('handleCommand', () => {
  it('should show help message on /connpass help', async () => {
    const mockInteraction = {
      channelId: 'test-channel',
      options: {
        getSubcommand: vi.fn().mockReturnValue('help'),
      },
      reply: vi.fn(),
    } as unknown as ChatInputCommandInteraction<CacheType>;

    const mockManager = {} as JobManager;
    const mockScheduler = {} as JobScheduler;

    await handleCommand(mockInteraction, mockManager, mockScheduler);

    expect(mockInteraction.reply).toHaveBeenCalledOnce();
    const replyArg = (mockInteraction.reply as any).mock.calls[0][0];
    expect(replyArg.content).toContain('Connpass Bot Commands');
    expect(replyArg.content).toContain('/connpass set');
    expect(replyArg.content).toContain('/connpass sort');
    expect(replyArg.content).toContain('/connpass status');
    expect(replyArg.content).toContain('/connpass remove');
    expect(replyArg.content).toContain('/connpass run');
    expect(replyArg.content).toContain('/connpass help');
    expect(replyArg.ephemeral).toBe(true);
  });
});
