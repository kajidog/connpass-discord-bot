import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BannedUser, IBanStore } from '@connpass-discord-bot/core';

interface StoredData {
  bans: Record<string, BannedUser>;
}

/**
 * ファイルベースバンストア
 */
export class FileBanStore implements IBanStore {
  private filePath: string;
  private data: StoredData | null = null;

  constructor(storeDir: string) {
    this.filePath = join(storeDir, 'bans.json');
  }

  private async load(): Promise<StoredData> {
    if (this.data) return this.data;

    if (!existsSync(this.filePath)) {
      this.data = { bans: {} };
      return this.data;
    }

    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as StoredData;
    } catch {
      this.data = { bans: {} };
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

  async save(ban: BannedUser): Promise<void> {
    const data = await this.load();
    data.bans[ban.discordUserId] = structuredClone(ban);
    await this.persist();
  }

  async delete(discordUserId: string): Promise<void> {
    const data = await this.load();
    delete data.bans[discordUserId];
    await this.persist();
  }

  async find(discordUserId: string): Promise<BannedUser | undefined> {
    const data = await this.load();
    const ban = data.bans[discordUserId];
    return ban ? structuredClone(ban) : undefined;
  }

  async list(): Promise<BannedUser[]> {
    const data = await this.load();
    return Object.values(data.bans).map((ban) => structuredClone(ban));
  }
}
