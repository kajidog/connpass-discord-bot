import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const eventSummaryCache = sqliteTable('event_summary_cache', {
  eventId: integer('event_id').primaryKey(),
  updatedAt: text('updated_at').notNull(),
  summary: text('summary').notNull(),
  cachedAt: text('cached_at').notNull(),
});
