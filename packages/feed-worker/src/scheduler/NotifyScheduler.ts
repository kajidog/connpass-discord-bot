import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type {
  IUserStore,
  IUserNotifySettingsStore,
  IUserNotifySentStore,
  UserNotifySettings,
  ConnpassEvent,
} from '@connpass-discord-bot/core';
import { Logger, LogLevel, ActionType } from '@connpass-discord-bot/core';

const logger = Logger.getInstance();

export interface NotifySchedulerOptions {
  /** チェック間隔（ミリ秒）。デフォルト: 60000 (1分) */
  checkIntervalMs?: number;
  /** キャッシュTTL（ミリ秒）。デフォルト: 1800000 (30分) */
  cacheTtlMs?: number;
  /** レート制限遅延（ミリ秒）。デフォルト: 1100 */
  rateLimitDelayMs?: number;
}

/**
 * 通知送信インターフェース
 */
export interface INotifySink {
  /**
   * イベント通知をDMで送信
   */
  sendEventNotification(
    discordUserId: string,
    events: ConnpassEvent[]
  ): Promise<void>;
}

interface EventCache {
  nickname: string;
  date: string;
  events: ConnpassEvent[];
  fetchedAt: number;
}

/**
 * イベント通知スケジューラー
 * 登録ユーザーの参加予定イベント開始前にDM通知を送信
 */
export class NotifyScheduler {
  private checkInterval?: ReturnType<typeof setInterval>;
  private readonly checkIntervalMs: number;
  private readonly cacheTtlMs: number;
  private readonly rateLimitDelayMs: number;
  private isRunning = false;

  // イベントキャッシュ: `nickname:YYYY-MM-DD` -> EventCache
  private eventCache: Map<string, EventCache> = new Map();

  constructor(
    private readonly userStore: IUserStore,
    private readonly notifySettingsStore: IUserNotifySettingsStore,
    private readonly notifySentStore: IUserNotifySentStore,
    private readonly connpassClient: ConnpassClient,
    private readonly sink: INotifySink,
    options: NotifySchedulerOptions = {}
  ) {
    this.checkIntervalMs = options.checkIntervalMs ?? 60_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 30 * 60 * 1000; // 30分
    this.rateLimitDelayMs = options.rateLimitDelayMs ?? 1_100;
  }

  /**
   * スケジューラーを開始
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 初回チェック
    await this.checkAndNotify();

    // 定期チェックループ開始
    this.checkInterval = setInterval(() => {
      this.checkAndNotify().catch((error) => {
        logger.error('NotifyScheduler', 'Check cycle failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.checkIntervalMs);

    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULER_START,
      component: 'NotifyScheduler',
      message: `NotifyScheduler started with ${this.checkIntervalMs}ms check interval`,
      metadata: { checkIntervalMs: this.checkIntervalMs },
    });
  }

  /**
   * スケジューラーを停止
   */
  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.isRunning = false;
    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.SCHEDULER_STOP,
      component: 'NotifyScheduler',
      message: 'NotifyScheduler stopped',
    });
  }

  /**
   * 通知チェックと送信を実行
   */
  private async checkAndNotify(): Promise<void> {
    try {
      // 通知有効ユーザー一覧を取得
      const enabledSettings = await this.notifySettingsStore.listEnabled();

      if (enabledSettings.length === 0) {
        return;
      }

      logger.debug('NotifyScheduler', `Checking ${enabledSettings.length} users for notifications`, {
        userCount: enabledSettings.length,
      });

      // 各ユーザーについてチェック
      for (const settings of enabledSettings) {
        try {
          await this.checkUserEvents(settings);
        } catch (error) {
          logger.error('NotifyScheduler', `Error checking user ${settings.discordUserId}`, {
            userId: settings.discordUserId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // レート制限遅延
        if (enabledSettings.indexOf(settings) < enabledSettings.length - 1) {
          await this.delay(this.rateLimitDelayMs);
        }
      }

      // 古い送信済みレコードをクリーンアップ（30日以上）
      await this.cleanupOldRecords();
    } catch (error) {
      logger.error('NotifyScheduler', 'Check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * ユーザーのイベントをチェックして通知
   */
  private async checkUserEvents(settings: UserNotifySettings): Promise<void> {
    // ユーザー情報取得
    const user = await this.userStore.find(settings.discordUserId);
    if (!user) {
      logger.warn('NotifyScheduler', `User not found: ${settings.discordUserId}`, {
        userId: settings.discordUserId,
      });
      return;
    }

    const now = new Date();
    const today = this.formatYmd(now);

    // 通知ウィンドウの終点時刻を計算
    const targetTime = new Date(
      now.getTime() + settings.minutesBefore * 60 * 1000
    );
    const targetDay = this.formatYmd(targetTime);

    // 今日のイベントを取得（キャッシュ活用）
    let events = await this.fetchUserEvents(user.connpassNickname, today);

    // 通知ウィンドウが日をまたぐ場合は翌日のイベントも取得
    if (today !== targetDay) {
      const tomorrowEvents = await this.fetchUserEvents(
        user.connpassNickname,
        targetDay
      );
      events = [...events, ...tomorrowEvents];
    }

    if (events.length === 0) {
      return;
    }

    // 通知対象イベントを抽出
    // 条件: 現在時刻 < 開始時刻 <= 現在時刻 + minutesBefore
    const toNotify = events.filter((event) => {
      const startTime = new Date(event.startedAt);
      return now < startTime && startTime <= targetTime;
    });

    if (toNotify.length === 0) {
      return;
    }

    // 未送信イベントをフィルタ
    const sentIds = await this.notifySentStore.getSentEventIds(
      settings.discordUserId
    );
    const unsent = toNotify.filter((e) => !sentIds.includes(e.id));

    if (unsent.length === 0) {
      return;
    }

    logger.logAction({
      level: LogLevel.INFO,
      actionType: ActionType.NOTIFY_SEND,
      component: 'NotifyScheduler',
      message: `Sending ${unsent.length} notifications`,
      userId: settings.discordUserId,
      metadata: {
        eventCount: unsent.length,
        eventIds: unsent.map((e) => e.id),
      },
    });

    // 通知送信
    try {
      await this.sink.sendEventNotification(settings.discordUserId, unsent);

      // 送信済み記録
      for (const event of unsent) {
        await this.notifySentStore.markSent(settings.discordUserId, event.id);
      }
    } catch (error) {
      logger.logAction({
        level: LogLevel.ERROR,
        actionType: ActionType.NOTIFY_ERROR,
        component: 'NotifyScheduler',
        message: 'Failed to send notification',
        userId: settings.discordUserId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          eventCount: unsent.length,
        },
      });
    }
  }

  /**
   * ユーザーのイベントを取得（キャッシュあり）
   */
  private async fetchUserEvents(
    nickname: string,
    date: string
  ): Promise<ConnpassEvent[]> {
    const cacheKey = `${nickname}:${date}`;
    const cached = this.eventCache.get(cacheKey);

    // キャッシュが有効な場合はそれを返す
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.events;
    }

    // API呼び出し
    try {
      const response = await this.connpassClient.searchEvents({
        nickname,
        ymdFrom: date,
        ymdTo: date,
        order: 2, // started_asc
      });

      const events = response.events as ConnpassEvent[];

      // キャッシュ更新
      this.eventCache.set(cacheKey, {
        nickname,
        date,
        events,
        fetchedAt: Date.now(),
      });

      // 古いキャッシュをクリア
      this.cleanupCache();

      return events;
    } catch (error) {
      logger.error('NotifyScheduler', `Failed to fetch events for ${nickname}`, {
        nickname,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
      return cached?.events ?? [];
    }
  }

  /**
   * 古いキャッシュエントリを削除
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.eventCache.entries()) {
      if (now - value.fetchedAt > this.cacheTtlMs * 2) {
        this.eventCache.delete(key);
      }
    }
  }

  /**
   * 古い送信済みレコードをクリーンアップ
   */
  private async cleanupOldRecords(): Promise<void> {
    try {
      const deletedCount = await this.notifySentStore.cleanupOlderThan(30);
      if (deletedCount > 0) {
        logger.debug('NotifyScheduler', `Cleaned up ${deletedCount} old sent records`, {
          deletedCount,
        });
      }
    } catch (error) {
      logger.error('NotifyScheduler', 'Cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private formatYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
