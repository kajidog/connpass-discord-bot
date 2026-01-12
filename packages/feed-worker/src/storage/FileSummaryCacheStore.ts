import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { EventSummaryCache, ISummaryCacheStore } from '@connpass-discord-bot/core';

/**
 * ファイルベースのサマリーキャッシュストア
 */
export class FileSummaryCacheStore implements ISummaryCacheStore {
  private readonly filePath: string;
  private cache: Map<number, EventSummaryCache> = new Map();

  constructor(storeDir: string, filename = 'summary-cache.json') {
    this.filePath = join(storeDir, filename);
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        if (Array.isArray(data)) {
          for (const item of data) {
            this.cache.set(item.eventId, item);
          }
        }
      }
    } catch (error) {
      console.error('[FileSummaryCacheStore] Failed to load:', error);
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.cache.values());
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[FileSummaryCacheStore] Failed to persist:', error);
    }
  }

  async save(item: EventSummaryCache): Promise<void> {
    this.cache.set(item.eventId, item);
    this.persist();
  }

  async get(eventId: number): Promise<EventSummaryCache | undefined> {
    return this.cache.get(eventId);
  }

  async delete(eventId: number): Promise<void> {
    this.cache.delete(eventId);
    this.persist();
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const threshold = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let count = 0;

    for (const [eventId, item] of this.cache.entries()) {
      const cachedAt = new Date(item.cachedAt).getTime();
      if (cachedAt < threshold) {
        this.cache.delete(eventId);
        count++;
      }
    }

    if (count > 0) {
      this.persist();
    }

    return count;
  }
}
