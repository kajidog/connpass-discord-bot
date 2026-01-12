import type { Feed, IFeedStore } from '@connpass-discord-bot/core';

/**
 * インメモリフィードストア（テスト・開発用）
 */
export class InMemoryFeedStore implements IFeedStore {
  private feeds = new Map<string, Feed>();

  async save(feed: Feed): Promise<void> {
    this.feeds.set(feed.config.id, structuredClone(feed));
  }

  async delete(feedId: string): Promise<void> {
    this.feeds.delete(feedId);
  }

  async get(feedId: string): Promise<Feed | undefined> {
    const feed = this.feeds.get(feedId);
    return feed ? structuredClone(feed) : undefined;
  }

  async list(): Promise<Feed[]> {
    return Array.from(this.feeds.values()).map((f) => structuredClone(f));
  }
}
