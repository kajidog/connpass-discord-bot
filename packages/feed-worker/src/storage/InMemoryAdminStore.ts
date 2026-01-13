import type { AdminUser, IAdminStore } from '@connpass-discord-bot/core';

/**
 * インメモリ管理者ストア（テスト・開発用）
 */
export class InMemoryAdminStore implements IAdminStore {
  private admins = new Map<string, AdminUser>();

  async save(admin: AdminUser): Promise<void> {
    this.admins.set(admin.discordUserId, structuredClone(admin));
  }

  async delete(discordUserId: string): Promise<void> {
    this.admins.delete(discordUserId);
  }

  async find(discordUserId: string): Promise<AdminUser | undefined> {
    const admin = this.admins.get(discordUserId);
    return admin ? structuredClone(admin) : undefined;
  }

  async list(): Promise<AdminUser[]> {
    return Array.from(this.admins.values()).map((admin) => structuredClone(admin));
  }
}
