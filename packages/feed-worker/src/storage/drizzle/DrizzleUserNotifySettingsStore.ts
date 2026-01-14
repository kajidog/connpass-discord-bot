import { eq } from 'drizzle-orm';
import type {
  UserNotifySettings,
  IUserNotifySettingsStore,
} from '@connpass-discord-bot/core';
import type { DrizzleDB } from '../../db/index.js';
import { userNotifySettings } from '../../db/schema/index.js';

export class DrizzleUserNotifySettingsStore implements IUserNotifySettingsStore {
  constructor(private db: DrizzleDB) {}

  async save(settings: UserNotifySettings): Promise<void> {
    await this.db
      .insert(userNotifySettings)
      .values({
        discordUserId: settings.discordUserId,
        enabled: settings.enabled,
        minutesBefore: settings.minutesBefore,
        updatedAt: settings.updatedAt,
      })
      .onConflictDoUpdate({
        target: userNotifySettings.discordUserId,
        set: {
          enabled: settings.enabled,
          minutesBefore: settings.minutesBefore,
          updatedAt: settings.updatedAt,
        },
      });
  }

  async find(discordUserId: string): Promise<UserNotifySettings | undefined> {
    const row = await this.db.query.userNotifySettings.findFirst({
      where: eq(userNotifySettings.discordUserId, discordUserId),
    });
    if (!row) return undefined;
    return {
      discordUserId: row.discordUserId,
      enabled: row.enabled,
      minutesBefore: row.minutesBefore,
      updatedAt: row.updatedAt,
    };
  }

  async listEnabled(): Promise<UserNotifySettings[]> {
    const rows = await this.db.query.userNotifySettings.findMany({
      where: eq(userNotifySettings.enabled, true),
    });
    return rows.map((row) => ({
      discordUserId: row.discordUserId,
      enabled: row.enabled,
      minutesBefore: row.minutesBefore,
      updatedAt: row.updatedAt,
    }));
  }

  async delete(discordUserId: string): Promise<void> {
    await this.db
      .delete(userNotifySettings)
      .where(eq(userNotifySettings.discordUserId, discordUserId));
  }
}
