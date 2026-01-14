import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const userNotifySentEvents = sqliteTable(
  'user_notify_sent_events',
  {
    discordUserId: text('discord_user_id')
      .notNull()
      .references(() => users.discordUserId, { onDelete: 'cascade' }),
    eventId: integer('event_id').notNull(),
    notifiedAt: text('notified_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.discordUserId, table.eventId] })]
);
