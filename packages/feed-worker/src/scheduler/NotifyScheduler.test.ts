import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotifyScheduler } from './NotifyScheduler.js';
import type { INotifySink } from './NotifyScheduler.js';
import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type {
  IUserStore,
  IUserNotifySettingsStore,
  IUserNotifySentStore,
  UserNotifySettings,
  ConnpassEvent,
  User,
} from '@connpass-discord-bot/core';

// Logger をモック
vi.mock('@connpass-discord-bot/core', async () => {
  const actual = await vi.importActual('@connpass-discord-bot/core');
  return {
    ...actual,
    Logger: {
      getInstance: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        logAction: vi.fn(),
      }),
    },
  };
});

function createMockEvent(id: number, startedAt: string): ConnpassEvent {
  return {
    id,
    title: `Event ${id}`,
    catchPhrase: '',
    description: '',
    url: `https://connpass.com/event/${id}/`,
    hashTag: '',
    startedAt,
    endedAt: startedAt,
    participantCount: 10,
    waitingCount: 0,
    ownerNickname: 'owner',
    ownerDisplayName: 'Owner',
    updatedAt: new Date().toISOString(),
  };
}

describe('NotifyScheduler', () => {
  let mockUserStore: IUserStore;
  let mockNotifySettingsStore: IUserNotifySettingsStore;
  let mockNotifySentStore: IUserNotifySentStore;
  let mockClient: ConnpassClient;
  let mockSink: INotifySink;
  let scheduler: NotifyScheduler;

  beforeEach(() => {
    vi.useFakeTimers();

    mockUserStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
    };

    mockNotifySettingsStore = {
      save: vi.fn(),
      find: vi.fn(),
      listEnabled: vi.fn(),
      delete: vi.fn(),
    };

    mockNotifySentStore = {
      markSent: vi.fn(),
      isSent: vi.fn(),
      getSentEventIds: vi.fn(),
      cleanupOlderThan: vi.fn(),
    };

    mockClient = {
      searchEvents: vi.fn(),
    } as unknown as ConnpassClient;

    mockSink = {
      sendEventNotification: vi.fn(),
    };
  });

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('start を呼ぶと初回チェックが実行される', async () => {
    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([]);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000 }
    );
    await scheduler.start();

    expect(mockNotifySettingsStore.listEnabled).toHaveBeenCalledTimes(1);
  });

  it('start を複数回呼んでも重複しない', async () => {
    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([]);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000 }
    );
    await scheduler.start();
    await scheduler.start();

    expect(mockNotifySettingsStore.listEnabled).toHaveBeenCalledTimes(1);
  });

  it('通知有効ユーザーがいない場合は何もしない', async () => {
    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([]);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000 }
    );
    await scheduler.start();

    expect(mockUserStore.find).not.toHaveBeenCalled();
    expect(mockClient.searchEvents).not.toHaveBeenCalled();
  });

  it('ユーザーが見つからない場合はスキップする', async () => {
    const settings: UserNotifySettings = {
      discordUserId: 'user-1',
      enabled: true,
      minutesBefore: 15,
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([settings]);
    vi.mocked(mockUserStore.find).mockResolvedValue(undefined);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000 }
    );
    await scheduler.start();

    expect(mockUserStore.find).toHaveBeenCalledWith('user-1');
    expect(mockClient.searchEvents).not.toHaveBeenCalled();
  });

  it('開始時間がウィンドウ内の未送信イベントを通知する', async () => {
    const now = new Date('2024-06-15T10:00:00+09:00');
    vi.setSystemTime(now);

    const settings: UserNotifySettings = {
      discordUserId: 'user-1',
      enabled: true,
      minutesBefore: 15,
      updatedAt: now.toISOString(),
    };

    const user: User = {
      discordUserId: 'user-1',
      connpassNickname: 'testuser',
      registeredAt: now.toISOString(),
    };

    // イベント開始が10:10 = 10分後（15分ウィンドウ内）
    const event = createMockEvent(100, '2024-06-15T10:10:00+09:00');

    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([settings]);
    vi.mocked(mockUserStore.find).mockResolvedValue(user);
    vi.mocked(mockClient.searchEvents).mockResolvedValue({
      events: [event],
      eventsReturned: 1,
      eventsAvailable: 1,
      eventsStart: 1,
    });
    vi.mocked(mockNotifySentStore.getSentEventIds).mockResolvedValue([]);
    vi.mocked(mockSink.sendEventNotification).mockResolvedValue(undefined);
    vi.mocked(mockNotifySentStore.markSent).mockResolvedValue(undefined);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000, rateLimitDelayMs: 0 }
    );
    await scheduler.start();

    expect(mockSink.sendEventNotification).toHaveBeenCalledWith('user-1', [event]);
    expect(mockNotifySentStore.markSent).toHaveBeenCalledWith('user-1', 100);
  });

  it('既に送信済みのイベントは通知しない', async () => {
    const now = new Date('2024-06-15T10:00:00+09:00');
    vi.setSystemTime(now);

    const settings: UserNotifySettings = {
      discordUserId: 'user-1',
      enabled: true,
      minutesBefore: 15,
      updatedAt: now.toISOString(),
    };

    const user: User = {
      discordUserId: 'user-1',
      connpassNickname: 'testuser',
      registeredAt: now.toISOString(),
    };

    const event = createMockEvent(100, '2024-06-15T10:10:00+09:00');

    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([settings]);
    vi.mocked(mockUserStore.find).mockResolvedValue(user);
    vi.mocked(mockClient.searchEvents).mockResolvedValue({
      events: [event],
      eventsReturned: 1,
      eventsAvailable: 1,
      eventsStart: 1,
    });
    vi.mocked(mockNotifySentStore.getSentEventIds).mockResolvedValue([100]); // 既送信
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000, rateLimitDelayMs: 0 }
    );
    await scheduler.start();

    expect(mockSink.sendEventNotification).not.toHaveBeenCalled();
  });

  it('開始時間がウィンドウ外のイベントは通知しない', async () => {
    const now = new Date('2024-06-15T10:00:00+09:00');
    vi.setSystemTime(now);

    const settings: UserNotifySettings = {
      discordUserId: 'user-1',
      enabled: true,
      minutesBefore: 15,
      updatedAt: now.toISOString(),
    };

    const user: User = {
      discordUserId: 'user-1',
      connpassNickname: 'testuser',
      registeredAt: now.toISOString(),
    };

    // イベント開始が11:00 = 60分後（15分ウィンドウ外）
    const event = createMockEvent(100, '2024-06-15T11:00:00+09:00');

    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([settings]);
    vi.mocked(mockUserStore.find).mockResolvedValue(user);
    vi.mocked(mockClient.searchEvents).mockResolvedValue({
      events: [event],
      eventsReturned: 1,
      eventsAvailable: 1,
      eventsStart: 1,
    });
    vi.mocked(mockNotifySentStore.getSentEventIds).mockResolvedValue([]);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000, rateLimitDelayMs: 0 }
    );
    await scheduler.start();

    expect(mockSink.sendEventNotification).not.toHaveBeenCalled();
  });

  it('過去のイベントは通知しない', async () => {
    const now = new Date('2024-06-15T10:00:00+09:00');
    vi.setSystemTime(now);

    const settings: UserNotifySettings = {
      discordUserId: 'user-1',
      enabled: true,
      minutesBefore: 15,
      updatedAt: now.toISOString(),
    };

    const user: User = {
      discordUserId: 'user-1',
      connpassNickname: 'testuser',
      registeredAt: now.toISOString(),
    };

    // イベント開始が9:50 = 過去
    const event = createMockEvent(100, '2024-06-15T09:50:00+09:00');

    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([settings]);
    vi.mocked(mockUserStore.find).mockResolvedValue(user);
    vi.mocked(mockClient.searchEvents).mockResolvedValue({
      events: [event],
      eventsReturned: 1,
      eventsAvailable: 1,
      eventsStart: 1,
    });
    vi.mocked(mockNotifySentStore.getSentEventIds).mockResolvedValue([]);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000, rateLimitDelayMs: 0 }
    );
    await scheduler.start();

    expect(mockSink.sendEventNotification).not.toHaveBeenCalled();
  });

  it('stop で正常に停止する', async () => {
    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([]);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(0);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000 }
    );
    await scheduler.start();
    await scheduler.stop();

    // stop 後は interval が実行されない
    vi.advanceTimersByTime(120000);
    expect(mockNotifySettingsStore.listEnabled).toHaveBeenCalledTimes(1);
  });

  it('古い送信済みレコードのクリーンアップが実行される', async () => {
    // クリーンアップは listEnabled が結果を返す場合にのみ実行される
    const settings: UserNotifySettings = {
      discordUserId: 'user-1',
      enabled: true,
      minutesBefore: 15,
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(mockNotifySettingsStore.listEnabled).mockResolvedValue([settings]);
    // ユーザーが見つからないのでイベントチェックはスキップされるが、クリーンアップは実行される
    vi.mocked(mockUserStore.find).mockResolvedValue(undefined);
    vi.mocked(mockNotifySentStore.cleanupOlderThan).mockResolvedValue(5);

    scheduler = new NotifyScheduler(
      mockUserStore,
      mockNotifySettingsStore,
      mockNotifySentStore,
      mockClient,
      mockSink,
      { checkIntervalMs: 60000, rateLimitDelayMs: 0 }
    );
    await scheduler.start();

    expect(mockNotifySentStore.cleanupOlderThan).toHaveBeenCalledWith(30);
  });
});
