import type { IAdminStore, IBanStore } from '@connpass-discord-bot/core';

export async function isAdminUser(adminStore: IAdminStore, discordUserId: string): Promise<boolean> {
  const admin = await adminStore.find(discordUserId);
  return Boolean(admin);
}

export async function hasAnyAdmin(adminStore: IAdminStore): Promise<boolean> {
  const admins = await adminStore.list();
  return admins.length > 0;
}

export async function isBannedUser(banStore: IBanStore, discordUserId: string): Promise<boolean> {
  const banned = await banStore.find(discordUserId);
  return Boolean(banned);
}
