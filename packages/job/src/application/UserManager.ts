import { User } from '../domain/User';
import { IUserStore } from '../domain/repositories/IUserStore';

export class UserManager {
  constructor(private readonly userStore: IUserStore) {}

  async register(discordUserId: string, connpassNickname: string): Promise<User> {
    const user: User = { discordUserId, connpassNickname };
    await this.userStore.save(user);
    return user;
  }

  async find(discordUserId: string): Promise<User | undefined> {
    return this.userStore.find(discordUserId);
  }

  async unregister(discordUserId: string): Promise<void> {
    await this.userStore.delete(discordUserId);
  }
}
