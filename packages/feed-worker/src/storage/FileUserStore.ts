import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { User, IUserStore } from '@connpass-discord-bot/core';

interface StoredData {
  users: Record<string, User>;
}

/**
 * ファイルベースユーザーストア
 */
export class FileUserStore implements IUserStore {
  private filePath: string;
  private data: StoredData | null = null;

  constructor(storeDir: string) {
    this.filePath = join(storeDir, 'users.json');
  }

  private async load(): Promise<StoredData> {
    if (this.data) return this.data;

    if (!existsSync(this.filePath)) {
      this.data = { users: {} };
      return this.data;
    }

    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as StoredData;
    } catch {
      this.data = { users: {} };
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

  async save(user: User): Promise<void> {
    const data = await this.load();
    data.users[user.discordUserId] = structuredClone(user);
    await this.persist();
  }

  async delete(discordUserId: string): Promise<void> {
    const data = await this.load();
    delete data.users[discordUserId];
    await this.persist();
  }

  async find(discordUserId: string): Promise<User | undefined> {
    const data = await this.load();
    const user = data.users[discordUserId];
    return user ? structuredClone(user) : undefined;
  }
}
