import { eq } from 'drizzle-orm';
import type { BannedUser, IBanStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { bannedUsers } from '../../db/schema/index.js';

export class DrizzleBanStore implements IBanStore {
  constructor(private db: DrizzleDB) {}

  async save(ban: BannedUser): Promise<void> {
    await this.db
      .insert(bannedUsers)
      .values({
        discordUserId: ban.discordUserId,
        bannedAt: ban.bannedAt,
        bannedBy: ban.bannedBy ?? null,
        reason: ban.reason ?? null,
      })
      .onConflictDoUpdate({
        target: bannedUsers.discordUserId,
        set: {
          bannedAt: ban.bannedAt,
          bannedBy: ban.bannedBy ?? null,
          reason: ban.reason ?? null,
        },
      });
  }

  async delete(discordUserId: string): Promise<void> {
    await this.db
      .delete(bannedUsers)
      .where(eq(bannedUsers.discordUserId, discordUserId));
  }

  async find(discordUserId: string): Promise<BannedUser | undefined> {
    const row = await this.db.query.bannedUsers.findFirst({
      where: eq(bannedUsers.discordUserId, discordUserId),
    });
    if (!row) return undefined;
    return {
      discordUserId: row.discordUserId,
      bannedAt: row.bannedAt,
      bannedBy: row.bannedBy ?? undefined,
      reason: row.reason ?? undefined,
    };
  }

  async list(): Promise<BannedUser[]> {
    const rows = await this.db.query.bannedUsers.findMany();
    return rows.map((row) => ({
      discordUserId: row.discordUserId,
      bannedAt: row.bannedAt,
      bannedBy: row.bannedBy ?? undefined,
      reason: row.reason ?? undefined,
    }));
  }
}
