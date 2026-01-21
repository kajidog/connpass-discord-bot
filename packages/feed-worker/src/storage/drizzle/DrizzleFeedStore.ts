import { eq, lt } from 'drizzle-orm';
import type { Feed, FeedOrder, IFeedStore } from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { feeds, feedSentEvents } from '../../db/schema/index.js';

export class DrizzleFeedStore implements IFeedStore {
  constructor(private db: DrizzleDB) {}

  async save(feed: Feed): Promise<void> {
    const { config, state } = feed;

    await this.db.transaction(async (tx) => {
      await tx
        .insert(feeds)
        .values({
          id: config.id,
          channelId: config.channelId,
          schedule: config.schedule,
          rangeDays: config.rangeDays,
          keywordsAnd: config.keywordsAnd
            ? JSON.stringify(config.keywordsAnd)
            : null,
          keywordsOr: config.keywordsOr
            ? JSON.stringify(config.keywordsOr)
            : null,
          location: config.location ? JSON.stringify(config.location) : null,
          hashtag: config.hashtag ?? null,
          ownerNickname: config.ownerNickname ?? null,
          order: config.order ?? null,
          minParticipantCount: config.minParticipantCount ?? null,
          minLimit: config.minLimit ?? null,
          useAi: config.useAi ?? null,
          lastRunAt: state.lastRunAt ?? null,
          nextRunAt: state.nextRunAt ?? null,
        })
        .onConflictDoUpdate({
          target: feeds.id,
          set: {
            channelId: config.channelId,
            schedule: config.schedule,
            rangeDays: config.rangeDays,
            keywordsAnd: config.keywordsAnd
              ? JSON.stringify(config.keywordsAnd)
              : null,
            keywordsOr: config.keywordsOr
              ? JSON.stringify(config.keywordsOr)
              : null,
            location: config.location ? JSON.stringify(config.location) : null,
            hashtag: config.hashtag ?? null,
            ownerNickname: config.ownerNickname ?? null,
            order: config.order ?? null,
            minParticipantCount: config.minParticipantCount ?? null,
            minLimit: config.minLimit ?? null,
            useAi: config.useAi ?? null,
            lastRunAt: state.lastRunAt ?? null,
            nextRunAt: state.nextRunAt ?? null,
          },
        });

      await tx.delete(feedSentEvents).where(eq(feedSentEvents.feedId, config.id));

      const sentEntries = Object.entries(state.sentEvents);
      if (sentEntries.length > 0) {
        await tx.insert(feedSentEvents).values(
          sentEntries.map(([eventId, updatedAt]) => ({
            feedId: config.id,
            eventId: Number(eventId),
            updatedAt,
          }))
        );
      }
    });
  }

  async delete(feedId: string): Promise<void> {
    await this.db.delete(feeds).where(eq(feeds.id, feedId));
  }

  async get(feedId: string): Promise<Feed | undefined> {
    const feedRow = await this.db.query.feeds.findFirst({
      where: eq(feeds.id, feedId),
    });

    if (!feedRow) return undefined;

    const sentEventsRows = await this.db.query.feedSentEvents.findMany({
      where: eq(feedSentEvents.feedId, feedId),
    });

    return this.rowToFeed(feedRow, sentEventsRows);
  }

  async list(): Promise<Feed[]> {
    const feedRows = await this.db.query.feeds.findMany();
    const allSentEvents = await this.db.query.feedSentEvents.findMany();

    return feedRows.map((row) => {
      const sentEventsForFeed = allSentEvents.filter(
        (e) => e.feedId === row.id
      );
      return this.rowToFeed(row, sentEventsForFeed);
    });
  }

  private rowToFeed(
    row: typeof feeds.$inferSelect,
    sentEventsRows: (typeof feedSentEvents.$inferSelect)[]
  ): Feed {
    const sentEvents: Record<number, string> = {};
    for (const se of sentEventsRows) {
      sentEvents[se.eventId] = se.updatedAt;
    }

    return {
      config: {
        id: row.id,
        channelId: row.channelId,
        schedule: row.schedule,
        rangeDays: row.rangeDays,
        keywordsAnd: row.keywordsAnd
          ? JSON.parse(row.keywordsAnd)
          : undefined,
        keywordsOr: row.keywordsOr ? JSON.parse(row.keywordsOr) : undefined,
        location: row.location ? JSON.parse(row.location) : undefined,
        hashtag: row.hashtag ?? undefined,
        ownerNickname: row.ownerNickname ?? undefined,
        order: (row.order as FeedOrder) ?? undefined,
        minParticipantCount: row.minParticipantCount ?? undefined,
        minLimit: row.minLimit ?? undefined,
        useAi: row.useAi ?? undefined,
      },
      state: {
        lastRunAt: row.lastRunAt ?? undefined,
        nextRunAt: row.nextRunAt ?? undefined,
        sentEvents,
      },
    };
  }

  /**
   * 指定日数より古い送信済みイベントレコードを削除
   * @param olderThanDays 削除対象の日数
   * @returns 削除された行数
   */
  async cleanupSentEvents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString();

    const result = await this.db
      .delete(feedSentEvents)
      .where(lt(feedSentEvents.updatedAt, cutoffIso));

    return result.changes ?? 0;
  }
}
