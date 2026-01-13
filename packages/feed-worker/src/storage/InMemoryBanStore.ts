import type { BannedUser, IBanStore } from '@connpass-discord-bot/core';

/**
 * インメモリバンストア（テスト・開発用）
 */
export class InMemoryBanStore implements IBanStore {
  private bans = new Map<string, BannedUser>();

  async save(ban: BannedUser): Promise<void> {
    this.bans.set(ban.discordUserId, structuredClone(ban));
  }

  async delete(discordUserId: string): Promise<void> {
    this.bans.delete(discordUserId);
  }

  async find(discordUserId: string): Promise<BannedUser | undefined> {
    const ban = this.bans.get(discordUserId);
    return ban ? structuredClone(ban) : undefined;
  }

  async list(): Promise<BannedUser[]> {
    return Array.from(this.bans.values()).map((ban) => structuredClone(ban));
  }
}
