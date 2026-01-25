import { describe, it, expect } from 'vitest';
import { generateFeedCommand } from './feed.js';
import type { FeedConfig } from '../domain/types.js';

describe('generateFeedCommand', () => {
  it('should generate basic command with schedule', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * 1',
      rangeDays: 14,
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('/connpass feed apply');
    expect(result).toContain('channels:test-channel');
    expect(result).toContain('schedule:0\\ 9\\ *\\ *\\ 1');
  });

  it('should escape spaces in cron expression', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * 1-5',
      rangeDays: 14,
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('schedule:0\\ 9\\ *\\ *\\ 1-5');
  });

  it('should include keywords_and when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      keywordsAnd: ['TypeScript', 'React'],
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('keywords_and:TypeScript,React');
  });

  it('should include keywords_or when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      keywordsOr: ['Vue', 'Angular'],
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('keywords_or:Vue,Angular');
  });

  it('should include location when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      location: ['東京都', '大阪府'],
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('location:東京都,大阪府');
  });

  it('should include range_days when not default', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 30,
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('range_days:30');
  });

  it('should not include range_days when default (14)', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
    };

    const result = generateFeedCommand(config);

    expect(result).not.toContain('range_days:');
  });

  it('should include hashtag when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      hashtag: 'TypeScript',
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('hashtag:TypeScript');
  });

  it('should include owner_nickname when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      ownerNickname: 'test-owner',
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('owner_nickname:test-owner');
  });

  it('should include order when not default', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      order: 'updated_desc',
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('order:updated_desc');
  });

  it('should not include order when default (started_asc)', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      order: 'started_asc',
    };

    const result = generateFeedCommand(config);

    expect(result).not.toContain('order:');
  });

  it('should include min_participants when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      minParticipantCount: 10,
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('min_participants:10');
  });

  it('should include min_limit when set', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      minLimit: 50,
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('min_limit:50');
  });

  it('should include use_ai when true', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      useAi: true,
    };

    const result = generateFeedCommand(config);

    expect(result).toContain('use_ai:true');
  });

  it('should not include use_ai when false or undefined', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
      useAi: false,
    };

    const result = generateFeedCommand(config);

    expect(result).not.toContain('use_ai:');
  });

  it('should allow overriding target channel id', () => {
    const config: FeedConfig = {
      id: 'original-channel',
      channelId: 'original-channel',
      schedule: '0 9 * * *',
      rangeDays: 14,
    };

    const result = generateFeedCommand(config, 'new-channel');

    expect(result).toContain('channels:new-channel');
    expect(result).not.toContain('channels:original-channel');
  });

  it('should generate complete command with all options', () => {
    const config: FeedConfig = {
      id: 'test-channel',
      channelId: 'test-channel',
      schedule: '0 9 * * 1',
      rangeDays: 30,
      keywordsAnd: ['TypeScript', 'React'],
      keywordsOr: ['Vue', 'Angular'],
      location: ['東京都'],
      hashtag: 'frontend',
      ownerNickname: 'test-owner',
      order: 'updated_desc',
      minParticipantCount: 10,
      minLimit: 50,
      useAi: true,
    };

    const result = generateFeedCommand(config);

    expect(result).toBe(
      '/connpass feed apply channels:test-channel schedule:0\\ 9\\ *\\ *\\ 1 range_days:30 keywords_and:TypeScript,React keywords_or:Vue,Angular location:東京都 hashtag:frontend owner_nickname:test-owner order:updated_desc min_participants:10 min_limit:50 use_ai:true'
    );
  });
});
