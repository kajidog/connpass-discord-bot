import type { User, IUserStore } from '@connpass-discord-bot/core';

/**
 * インメモリユーザーストア（テスト・開発用）
 */
export class InMemoryUserStore implements IUserStore {
  private users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.discordUserId, structuredClone(user));
  }

  async delete(discordUserId: string): Promise<void> {
    this.users.delete(discordUserId);
  }

  async find(discordUserId: string): Promise<User | undefined> {
    const user = this.users.get(discordUserId);
    return user ? structuredClone(user) : undefined;
  }
}
