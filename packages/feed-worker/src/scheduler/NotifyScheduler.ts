import type { ConnpassClient } from '@kajidog/connpass-api-client';
import type {
  IUserStore,
  IUserNotifySettingsStore,
  IUserNotifySentStore,
  UserNotifySettings,
  ConnpassEvent,
} from '@connpass-discord-bot/core';

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
      this.checkAndNotify().catch(console.error);
    }, this.checkIntervalMs);

    console.log(
      `[NotifyScheduler] Started with ${this.checkIntervalMs}ms check interval`
    );
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
    console.log('[NotifyScheduler] Stopped');
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

      console.log(
        `[NotifyScheduler] Checking ${enabledSettings.length} users for notifications`
      );

      // 各ユーザーについてチェック
      for (const settings of enabledSettings) {
        try {
          await this.checkUserEvents(settings);
        } catch (error) {
          console.error(
            `[NotifyScheduler] Error checking user ${settings.discordUserId}:`,
            error
          );
        }

        // レート制限遅延
        if (enabledSettings.indexOf(settings) < enabledSettings.length - 1) {
          await this.delay(this.rateLimitDelayMs);
        }
      }

      // 古い送信済みレコードをクリーンアップ（30日以上）
      await this.cleanupOldRecords();
    } catch (error) {
      console.error('[NotifyScheduler] Check failed:', error);
    }
  }

  /**
   * ユーザーのイベントをチェックして通知
   */
  private async checkUserEvents(settings: UserNotifySettings): Promise<void> {
    // ユーザー情報取得
    const user = await this.userStore.find(settings.discordUserId);
    if (!user) {
      console.warn(
        `[NotifyScheduler] User not found: ${settings.discordUserId}`
      );
      return;
    }

    const now = new Date();
    const today = this.formatYmd(now);

    // 今日のイベントを取得（キャッシュ活用）
    const events = await this.fetchUserEvents(user.connpassNickname, today);

    if (events.length === 0) {
      return;
    }

    // 通知対象イベントを抽出
    // 条件: 現在時刻 < 開始時刻 <= 現在時刻 + minutesBefore
    const targetTime = new Date(
      now.getTime() + settings.minutesBefore * 60 * 1000
    );

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

    console.log(
      `[NotifyScheduler] Sending ${unsent.length} notifications to ${settings.discordUserId}`
    );

    // 通知送信
    try {
      await this.sink.sendEventNotification(settings.discordUserId, unsent);

      // 送信済み記録
      for (const event of unsent) {
        await this.notifySentStore.markSent(settings.discordUserId, event.id);
      }
    } catch (error) {
      console.error(
        `[NotifyScheduler] Failed to send notification to ${settings.discordUserId}:`,
        error
      );
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
      console.error(
        `[NotifyScheduler] Failed to fetch events for ${nickname}:`,
        error
      );
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
        console.log(
          `[NotifyScheduler] Cleaned up ${deletedCount} old sent records`
        );
      }
    } catch (error) {
      console.error('[NotifyScheduler] Cleanup failed:', error);
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
