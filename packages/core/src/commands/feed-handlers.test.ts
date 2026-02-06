import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleFeedSetCore,
  handleFeedStatusCore,
  handleFeedRemoveCore,
  handleFeedShareCore,
  handleFeedApplyCore,
} from './feed.js';
import type { IScheduler } from './feed.js';
import type { IFeedStore } from '../repositories/IFeedStore.js';
import type { Feed } from '../domain/types.js';
import type { CommandContext, FeedSetOptions } from './types.js';

describe('handleFeedSetCore', () => {
  let mockStore: IFeedStore;
  let mockScheduler: IScheduler;
  const ctx: CommandContext = {
    channelId: 'ch-1',
    userId: 'user-1',
    guildId: 'guild-1',
  };

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
    mockScheduler = {
      scheduleFeed: vi.fn(),
      unscheduleFeed: vi.fn(),
    };
  });

  it('無効なcron式の場合はエラーレスポンスを返す', async () => {
    const options: FeedSetOptions = { schedule: 'invalid-cron' };

    const result = await handleFeedSetCore(ctx, options, mockStore, mockScheduler);

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('無効なcron式です');
    expect(mockStore.save).not.toHaveBeenCalled();
  });

  it('新規フィードを正しく作成する', async () => {
    const options: FeedSetOptions = {
      schedule: '0 9 * * *',
      keywordsAnd: 'TypeScript,React',
      rangeDays: 30,
    };

    vi.mocked(mockStore.get)
      .mockResolvedValueOnce(undefined) // 既存なし
      .mockResolvedValueOnce({
        config: { id: 'ch-1', channelId: 'ch-1', schedule: '0 9 * * *', rangeDays: 30 },
        state: { sentEvents: {}, nextRunAt: Date.now() + 60000 },
      } as Feed);
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const result = await handleFeedSetCore(ctx, options, mockStore, mockScheduler);

    expect(result.ephemeral).toBe(false);
    expect(result.content).toContain('追加しました');
    expect(mockStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          channelId: 'ch-1',
          schedule: '0 9 * * *',
          rangeDays: 30,
          keywordsAnd: ['TypeScript', 'React'],
        }),
        state: { sentEvents: {} },
      })
    );
    expect(mockScheduler.scheduleFeed).toHaveBeenCalledWith('ch-1');
  });

  it('既存フィードを更新する場合は「更新しました」と表示する', async () => {
    const existingFeed: Feed = {
      config: {
        id: 'ch-1',
        channelId: 'ch-1',
        schedule: '0 12 * * *',
        rangeDays: 14,
      },
      state: { sentEvents: { 100: '2024-01-01T00:00:00Z' } },
    };

    vi.mocked(mockStore.get)
      .mockResolvedValueOnce(existingFeed)
      .mockResolvedValueOnce({
        ...existingFeed,
        config: { ...existingFeed.config, schedule: '0 9 * * *' },
        state: { ...existingFeed.state, nextRunAt: Date.now() + 60000 },
      });
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const options: FeedSetOptions = { schedule: '0 9 * * *' };
    const result = await handleFeedSetCore(ctx, options, mockStore, mockScheduler);

    expect(result.content).toContain('更新しました');
    // 既存の sentEvents が保持される
    expect(mockStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          sentEvents: { 100: '2024-01-01T00:00:00Z' },
        }),
      })
    );
  });

  it('キーワード（カンマ・スペース区切り）を正しくパースする', async () => {
    const options: FeedSetOptions = {
      schedule: '0 9 * * *',
      keywordsAnd: 'TypeScript React',
      keywordsOr: 'Vue,Angular',
    };

    vi.mocked(mockStore.get).mockResolvedValue(undefined).mockResolvedValue(undefined);
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    await handleFeedSetCore(ctx, options, mockStore, mockScheduler);

    expect(mockStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          keywordsAnd: ['TypeScript', 'React'],
          keywordsOr: ['Vue', 'Angular'],
        }),
      })
    );
  });

  it('都道府県リゾルバーを使って表示する', async () => {
    const options: FeedSetOptions = {
      schedule: '0 9 * * *',
      location: '13,27',
    };

    vi.mocked(mockStore.get)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        config: { id: 'ch-1', channelId: 'ch-1', schedule: '0 9 * * *', rangeDays: 14 },
        state: { sentEvents: {}, nextRunAt: Date.now() + 60000 },
      } as Feed);
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const resolver = (code: string) => (code === '13' ? '東京都' : code === '27' ? '大阪府' : code);
    const result = await handleFeedSetCore(ctx, options, mockStore, mockScheduler, resolver);

    expect(result.content).toContain('東京都');
    expect(result.content).toContain('大阪府');
  });

  it('スケジュールラベルが解決される', async () => {
    const options: FeedSetOptions = { schedule: '0 9 * * *' };

    vi.mocked(mockStore.get)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        config: { id: 'ch-1', channelId: 'ch-1', schedule: '0 9 * * *', rangeDays: 14 },
        state: { sentEvents: {}, nextRunAt: Date.now() + 60000 },
      } as Feed);
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const result = await handleFeedSetCore(ctx, options, mockStore, mockScheduler);

    expect(result.content).toContain('毎日 9:00');
  });

  it('規模フィルタを含むレスポンスを返す', async () => {
    const options: FeedSetOptions = {
      schedule: '0 9 * * *',
      minParticipants: 10,
      minLimit: 50,
    };

    vi.mocked(mockStore.get)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        config: { id: 'ch-1', channelId: 'ch-1', schedule: '0 9 * * *', rangeDays: 14 },
        state: { sentEvents: {}, nextRunAt: Date.now() + 60000 },
      } as Feed);
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const result = await handleFeedSetCore(ctx, options, mockStore, mockScheduler);

    expect(result.content).toContain('規模フィルタ');
    expect(result.content).toContain('10人以上');
    expect(result.content).toContain('50人以上');
  });
});

describe('handleFeedStatusCore', () => {
  let mockStore: IFeedStore;
  const ctx: CommandContext = {
    channelId: 'ch-1',
    userId: 'user-1',
  };

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
  });

  it('フィードが存在しない場合はメッセージを返す', async () => {
    vi.mocked(mockStore.get).mockResolvedValue(undefined);

    const result = await handleFeedStatusCore(ctx, mockStore);

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('フィードが設定されていません');
  });

  it('フィード設定を正しく表示する', async () => {
    const feed: Feed = {
      config: {
        id: 'ch-1',
        channelId: 'ch-1',
        schedule: '0 9 * * 1',
        rangeDays: 30,
        keywordsAnd: ['TypeScript'],
        keywordsOr: ['React', 'Vue'],
        hashtag: 'tech',
        ownerNickname: 'testuser',
        order: 'updated_desc',
        minParticipantCount: 5,
      },
      state: {
        sentEvents: { 1: '2024-01-01', 2: '2024-01-02' },
        lastRunAt: 1700000000000,
        nextRunAt: 1700100000000,
      },
    };

    vi.mocked(mockStore.get).mockResolvedValue(feed);

    const result = await handleFeedStatusCore(ctx, mockStore);

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('フィード設定');
    expect(result.content).toContain('毎週月曜 9:00');
    expect(result.content).toContain('30日');
    expect(result.content).toContain('TypeScript');
    expect(result.content).toContain('React');
    expect(result.content).toContain('#tech');
    expect(result.content).toContain('testuser');
    expect(result.content).toContain('updated_desc');
    expect(result.content).toContain('5人以上');
    expect(result.content).toContain('送信済みイベント数**: 2');
  });
});

describe('handleFeedRemoveCore', () => {
  let mockStore: IFeedStore;
  let mockScheduler: IScheduler;
  const ctx: CommandContext = { channelId: 'ch-1', userId: 'user-1' };

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
    mockScheduler = {
      scheduleFeed: vi.fn(),
      unscheduleFeed: vi.fn(),
    };
  });

  it('フィードが存在しない場合はメッセージを返す', async () => {
    vi.mocked(mockStore.get).mockResolvedValue(undefined);

    const result = await handleFeedRemoveCore(ctx, mockStore, mockScheduler);

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('フィードが設定されていません');
    expect(mockScheduler.unscheduleFeed).not.toHaveBeenCalled();
    expect(mockStore.delete).not.toHaveBeenCalled();
  });

  it('フィードを正しく削除する', async () => {
    const feed: Feed = {
      config: { id: 'ch-1', channelId: 'ch-1', schedule: '0 9 * * *', rangeDays: 14 },
      state: { sentEvents: {} },
    };

    vi.mocked(mockStore.get).mockResolvedValue(feed);
    vi.mocked(mockScheduler.unscheduleFeed).mockResolvedValue(undefined);
    vi.mocked(mockStore.delete).mockResolvedValue(undefined);

    const result = await handleFeedRemoveCore(ctx, mockStore, mockScheduler);

    expect(result.ephemeral).toBe(false);
    expect(result.content).toContain('削除しました');
    expect(mockScheduler.unscheduleFeed).toHaveBeenCalledWith('ch-1');
    expect(mockStore.delete).toHaveBeenCalledWith('ch-1');
  });
});

describe('handleFeedShareCore', () => {
  let mockStore: IFeedStore;
  const ctx: CommandContext = { channelId: 'ch-1', userId: 'user-1' };

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
  });

  it('フィードが存在しない場合はメッセージを返す', async () => {
    vi.mocked(mockStore.get).mockResolvedValue(undefined);

    const result = await handleFeedShareCore(ctx, mockStore);

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('フィードが設定されていません');
  });

  it('Discord用とCLI用の両方のコマンドを返す', async () => {
    const feed: Feed = {
      config: {
        id: 'ch-1',
        channelId: 'ch-1',
        schedule: '0 9 * * 1',
        rangeDays: 30,
        keywordsAnd: ['TypeScript'],
      },
      state: { sentEvents: {} },
    };

    vi.mocked(mockStore.get).mockResolvedValue(feed);

    const result = await handleFeedShareCore(ctx, mockStore);

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('/connpass feed set');
    expect(result.content).toContain('/connpass feed apply');
    expect(result.content).toContain('Discord用');
    expect(result.content).toContain('CLI用');
  });
});

describe('handleFeedApplyCore', () => {
  let mockStore: IFeedStore;
  let mockScheduler: IScheduler;

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
    mockScheduler = {
      scheduleFeed: vi.fn(),
      unscheduleFeed: vi.fn(),
    };
  });

  it('チャンネルIDが空の場合はエラーレスポンスを返す', async () => {
    const result = await handleFeedApplyCore(
      [],
      { schedule: '0 9 * * *' },
      mockStore,
      mockScheduler
    );

    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('チャンネルIDが指定されていません');
  });

  it('複数チャンネルに一括適用して結果を返す', async () => {
    vi.mocked(mockStore.get).mockResolvedValue(undefined);
    vi.mocked(mockStore.save).mockResolvedValue(undefined);
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const result = await handleFeedApplyCore(
      ['ch-1', 'ch-2'],
      { schedule: '0 9 * * *' },
      mockStore,
      mockScheduler
    );

    expect(result.ephemeral).toBe(false);
    expect(result.content).toContain('2 チャンネルに適用');
    expect(result.content).toContain('成功: 2');
    expect(result.content).toContain('失敗: 0');
  });

  it('一部失敗した場合もサマリに反映される', async () => {
    // ch-1 は成功、ch-2 は例外
    vi.mocked(mockStore.get).mockResolvedValue(undefined);
    vi.mocked(mockStore.save)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DB error'));
    vi.mocked(mockScheduler.scheduleFeed).mockResolvedValue(undefined);

    const result = await handleFeedApplyCore(
      ['ch-1', 'ch-2'],
      { schedule: '0 9 * * *' },
      mockStore,
      mockScheduler
    );

    expect(result.content).toContain('成功: 1');
    expect(result.content).toContain('失敗: 1');
    expect(result.content).toContain('DB error');
  });
});
