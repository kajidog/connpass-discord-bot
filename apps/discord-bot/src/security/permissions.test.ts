import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAdminUser, hasAnyAdmin, isBannedUser } from './permissions.js';
import type { IAdminStore, IBanStore, AdminUser, BannedUser } from '@connpass-discord-bot/core';

describe('isAdminUser', () => {
  let mockAdminStore: IAdminStore;

  beforeEach(() => {
    mockAdminStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
    };
  });

  it('管理者が存在する場合は true を返す', async () => {
    const admin: AdminUser = {
      discordUserId: 'admin-1',
      addedAt: new Date().toISOString(),
    };
    vi.mocked(mockAdminStore.find).mockResolvedValue(admin);

    const result = await isAdminUser(mockAdminStore, 'admin-1');

    expect(result).toBe(true);
    expect(mockAdminStore.find).toHaveBeenCalledWith('admin-1');
  });

  it('管理者が存在しない場合は false を返す', async () => {
    vi.mocked(mockAdminStore.find).mockResolvedValue(undefined);

    const result = await isAdminUser(mockAdminStore, 'non-admin');

    expect(result).toBe(false);
  });
});

describe('hasAnyAdmin', () => {
  let mockAdminStore: IAdminStore;

  beforeEach(() => {
    mockAdminStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
    };
  });

  it('管理者が1人以上いる場合は true を返す', async () => {
    const admins: AdminUser[] = [
      { discordUserId: 'admin-1', addedAt: new Date().toISOString() },
    ];
    vi.mocked(mockAdminStore.list).mockResolvedValue(admins);

    const result = await hasAnyAdmin(mockAdminStore);

    expect(result).toBe(true);
  });

  it('管理者がいない場合は false を返す', async () => {
    vi.mocked(mockAdminStore.list).mockResolvedValue([]);

    const result = await hasAnyAdmin(mockAdminStore);

    expect(result).toBe(false);
  });
});

describe('isBannedUser', () => {
  let mockBanStore: IBanStore;

  beforeEach(() => {
    mockBanStore = {
      save: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      list: vi.fn(),
    };
  });

  it('バンされている場合は true を返す', async () => {
    const banned: BannedUser = {
      discordUserId: 'banned-1',
      bannedAt: new Date().toISOString(),
      reason: 'spam',
    };
    vi.mocked(mockBanStore.find).mockResolvedValue(banned);

    const result = await isBannedUser(mockBanStore, 'banned-1');

    expect(result).toBe(true);
    expect(mockBanStore.find).toHaveBeenCalledWith('banned-1');
  });

  it('バンされていない場合は false を返す', async () => {
    vi.mocked(mockBanStore.find).mockResolvedValue(undefined);

    const result = await isBannedUser(mockBanStore, 'normal-user');

    expect(result).toBe(false);
  });
});
