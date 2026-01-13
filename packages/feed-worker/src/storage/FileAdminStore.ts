import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AdminUser, IAdminStore } from '@connpass-discord-bot/core';

interface StoredData {
  admins: Record<string, AdminUser>;
}

/**
 * ファイルベース管理者ストア
 */
export class FileAdminStore implements IAdminStore {
  private filePath: string;
  private data: StoredData | null = null;

  constructor(storeDir: string) {
    this.filePath = join(storeDir, 'admins.json');
  }

  private async load(): Promise<StoredData> {
    if (this.data) return this.data;

    if (!existsSync(this.filePath)) {
      this.data = { admins: {} };
      return this.data;
    }

    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as StoredData;
    } catch {
      this.data = { admins: {} };
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

  async save(admin: AdminUser): Promise<void> {
    const data = await this.load();
    data.admins[admin.discordUserId] = structuredClone(admin);
    await this.persist();
  }

  async delete(discordUserId: string): Promise<void> {
    const data = await this.load();
    delete data.admins[discordUserId];
    await this.persist();
  }

  async find(discordUserId: string): Promise<AdminUser | undefined> {
    const data = await this.load();
    const admin = data.admins[discordUserId];
    return admin ? structuredClone(admin) : undefined;
  }

  async list(): Promise<AdminUser[]> {
    const data = await this.load();
    return Object.values(data.admins).map((admin) => structuredClone(admin));
  }
}
