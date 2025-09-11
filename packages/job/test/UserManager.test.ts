import { describe, it, expect, vi } from 'vitest';
import { UserManager } from '../src/application/UserManager';
import { IUserStore } from '../src/domain/repositories/IUserStore';
import { User } from '../src/domain/User';

const mockUserStore: IUserStore = {
  find: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

describe('UserManager', () => {
  const userManager = new UserManager(mockUserStore);

  it('should register a user', async () => {
    const discordUserId = '123';
    const connpassNickname = 'testuser';
    await userManager.register(discordUserId, connpassNickname);

    expect(mockUserStore.save).toHaveBeenCalledWith({
      discordUserId,
      connpassNickname,
    });
  });

  it('should find a user', async () => {
    const discordUserId = '123';
    const user: User = { discordUserId, connpassNickname: 'testuser' };
    (mockUserStore.find as vi.Mock).mockResolvedValue(user);

    const foundUser = await userManager.find(discordUserId);

    expect(mockUserStore.find).toHaveBeenCalledWith(discordUserId);
    expect(foundUser).toEqual(user);
  });

  it('should unregister a user', async () => {
    const discordUserId = '123';
    await userManager.unregister(discordUserId);

    expect(mockUserStore.delete).toHaveBeenCalledWith(discordUserId);
  });
});
