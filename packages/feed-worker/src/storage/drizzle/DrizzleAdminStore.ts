import { eq } from 'drizzle-orm';
import type { AdminUser, IAdminStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { admins } from '../../db/schema/index.js';

export class DrizzleAdminStore implements IAdminStore {
  constructor(private db: DrizzleDB) {}

  async save(admin: AdminUser): Promise<void> {
    await this.db
      .insert(admins)
      .values({
        discordUserId: admin.discordUserId,
        addedAt: admin.addedAt,
        addedBy: admin.addedBy ?? null,
      })
      .onConflictDoUpdate({
        target: admins.discordUserId,
        set: {
          addedAt: admin.addedAt,
          addedBy: admin.addedBy ?? null,
        },
      });
  }

  async delete(discordUserId: string): Promise<void> {
    await this.db.delete(admins).where(eq(admins.discordUserId, discordUserId));
  }

  async find(discordUserId: string): Promise<AdminUser | undefined> {
    const row = await this.db.query.admins.findFirst({
      where: eq(admins.discordUserId, discordUserId),
    });
    if (!row) return undefined;
    return {
      discordUserId: row.discordUserId,
      addedAt: row.addedAt,
      addedBy: row.addedBy ?? undefined,
    };
  }

  async list(): Promise<AdminUser[]> {
    const rows = await this.db.query.admins.findMany();
    return rows.map((row) => ({
      discordUserId: row.discordUserId,
      addedAt: row.addedAt,
      addedBy: row.addedBy ?? undefined,
    }));
  }
}
