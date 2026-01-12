import type { NewEventsPayload } from '@connpass-discord-bot/core';

/**
 * 新着イベント通知を受け取るシンクインターフェース
 */
export interface ISink {
  /**
   * 新着イベントを処理する
   */
  handleNewEvents(payload: NewEventsPayload): Promise<void>;
}

/**
 * コンソール出力シンク（デバッグ用）
 */
export class ConsoleSink implements ISink {
  async handleNewEvents(payload: NewEventsPayload): Promise<void> {
    console.log(`[Feed ${payload.feedId}] ${payload.events.length} new events`);
    for (const event of payload.events) {
      console.log(`  - ${event.title} (${event.startedAt})`);
    }
  }
}
