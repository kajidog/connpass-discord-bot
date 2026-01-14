import { eq, and, lt } from 'drizzle-orm';
import type { IUserNotifySentStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { userNotifySentEvents } from '../../db/schema/index.js';

export class DrizzleUserNotifySentStore implements IUserNotifySentStore {
  constructor(private db: DrizzleDB) {}

  async markSent(discordUserId: string, eventId: number): Promise<void> {
    await this.db
      .insert(userNotifySentEvents)
      .values({
        discordUserId,
        eventId,
        notifiedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  }

  async isSent(discordUserId: string, eventId: number): Promise<boolean> {
    const row = await this.db.query.userNotifySentEvents.findFirst({
      where: and(
        eq(userNotifySentEvents.discordUserId, discordUserId),
        eq(userNotifySentEvents.eventId, eventId)
      ),
    });
    return row !== undefined;
  }

  async getSentEventIds(discordUserId: string): Promise<number[]> {
    const rows = await this.db.query.userNotifySentEvents.findMany({
      where: eq(userNotifySentEvents.discordUserId, discordUserId),
    });
    return rows.map((row) => row.eventId);
  }

  async cleanupOlderThan(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffIso = cutoffDate.toISOString();

    const result = await this.db
      .delete(userNotifySentEvents)
      .where(lt(userNotifySentEvents.notifiedAt, cutoffIso));

    return result.changes ?? 0;
  }
}
