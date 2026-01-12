import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Feed, IFeedStore } from '@connpass-discord-bot/core';

interface StoredData {
  feeds: Record<string, Feed>;
}

/**
 * ファイルベースフィードストア
 */
export class FileFeedStore implements IFeedStore {
  private filePath: string;
  private data: StoredData | null = null;

  constructor(storeDir: string) {
    this.filePath = join(storeDir, 'feeds.json');
  }

  private async load(): Promise<StoredData> {
    if (this.data) return this.data;

    if (!existsSync(this.filePath)) {
      this.data = { feeds: {} };
      return this.data;
    }

    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as StoredData;
    } catch {
      this.data = { feeds: {} };
    }

    return this.data;
  }

  private async persist(): Promise<void> {
    if (!this.data) return;

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async save(feed: Feed): Promise<void> {
    const data = await this.load();
    data.feeds[feed.config.id] = structuredClone(feed);
    await this.persist();
  }

  async delete(feedId: string): Promise<void> {
    const data = await this.load();
    delete data.feeds[feedId];
    await this.persist();
  }

  async get(feedId: string): Promise<Feed | undefined> {
    const data = await this.load();
    const feed = data.feeds[feedId];
    return feed ? structuredClone(feed) : undefined;
  }

  async list(): Promise<Feed[]> {
    const data = await this.load();
    return Object.values(data.feeds).map((f) => structuredClone(f));
  }
}
