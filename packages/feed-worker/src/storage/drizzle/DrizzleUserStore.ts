import { eq } from 'drizzle-orm';
import type { User, IUserStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { users } from '../../db/schema/index.js';

export class DrizzleUserStore implements IUserStore {
  constructor(private db: DrizzleDB) {}

  async save(user: User): Promise<void> {
    await this.db
      .insert(users)
      .values({
        discordUserId: user.discordUserId,
        connpassNickname: user.connpassNickname,
        registeredAt: user.registeredAt,
      })
      .onConflictDoUpdate({
        target: users.discordUserId,
        set: {
          connpassNickname: user.connpassNickname,
          registeredAt: user.registeredAt,
        },
      });
  }

  async delete(discordUserId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.discordUserId, discordUserId));
  }

  async find(discordUserId: string): Promise<User | undefined> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.discordUserId, discordUserId),
    });
    return row ?? undefined;
  }
}
