import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const feeds = sqliteTable('feeds', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  schedule: text('schedule').notNull(),
  rangeDays: integer('range_days').notNull().default(14),
  keywordsAnd: text('keywords_and'),
  keywordsOr: text('keywords_or'),
  location: text('location'),
  hashtag: text('hashtag'),
  ownerNickname: text('owner_nickname'),
  order: text('order'),
  minParticipantCount: integer('min_participant_count'),
  minLimit: integer('min_limit'),
  useAi: integer('use_ai', { mode: 'boolean' }),
  lastRunAt: integer('last_run_at'),
  nextRunAt: integer('next_run_at'),
});

export const feedSentEvents = sqliteTable(
  'feed_sent_events',
  {
    feedId: text('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    eventId: integer('event_id').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.feedId, table.eventId] })]
);
