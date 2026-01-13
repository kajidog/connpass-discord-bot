import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ChannelModelConfig, IChannelModelStore } from '@connpass-discord-bot/core';

interface StoredData {
  channels: Record<string, ChannelModelConfig>;
}

/**
 * ファイルベースチャンネルモデル設定ストア
 */
export class FileChannelModelStore implements IChannelModelStore {
  private filePath: string;
  private data: StoredData | null = null;

  constructor(storeDir: string) {
    this.filePath = join(storeDir, 'channel-models.json');
  }

  private async load(): Promise<StoredData> {
    if (this.data) return this.data;

    if (!existsSync(this.filePath)) {
      this.data = { channels: {} };
      return this.data;
    }

    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as StoredData;
    } catch {
      this.data = { channels: {} };
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

  async get(channelId: string): Promise<ChannelModelConfig | null> {
    const data = await this.load();
    const config = data.channels[channelId];
    return config ? structuredClone(config) : null;
  }

  async save(config: ChannelModelConfig): Promise<void> {
    const data = await this.load();
    data.channels[config.channelId] = structuredClone(config);
    await this.persist();
  }

  async delete(channelId: string): Promise<void> {
    const data = await this.load();
    delete data.channels[channelId];
    await this.persist();
  }

  /**
   * キャッシュをクリアして設定を再読み込み
   * 外部から設定ファイルを直接編集した場合に使用
   */
  async reload(): Promise<void> {
    this.data = null;
    await this.load();
  }

  /**
   * 全チャンネルの設定を取得
   */
  async getAll(): Promise<ChannelModelConfig[]> {
    const data = await this.load();
    return Object.values(data.channels).map(config => structuredClone(config));
  }
}
