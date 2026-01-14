import { eq, lt } from 'drizzle-orm';
import type { EventSummaryCache, ISummaryCacheStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { eventSummaryCache } from '../../db/schema/index.js';

export class DrizzleSummaryCacheStore implements ISummaryCacheStore {
  constructor(private db: DrizzleDB) {}

  async save(cache: EventSummaryCache): Promise<void> {
    await this.db
      .insert(eventSummaryCache)
      .values({
        eventId: cache.eventId,
        updatedAt: cache.updatedAt,
        summary: cache.summary,
        cachedAt: cache.cachedAt,
      })
      .onConflictDoUpdate({
        target: eventSummaryCache.eventId,
        set: {
          updatedAt: cache.updatedAt,
          summary: cache.summary,
          cachedAt: cache.cachedAt,
        },
      });
  }

  async get(eventId: number): Promise<EventSummaryCache | undefined> {
    const row = await this.db.query.eventSummaryCache.findFirst({
      where: eq(eventSummaryCache.eventId, eventId),
    });
    return row ?? undefined;
  }

  async delete(eventId: number): Promise<void> {
    await this.db
      .delete(eventSummaryCache)
      .where(eq(eventSummaryCache.eventId, eventId));
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString();

    const result = await this.db
      .delete(eventSummaryCache)
      .where(lt(eventSummaryCache.cachedAt, cutoffIso));

    return result.changes;
  }
}
