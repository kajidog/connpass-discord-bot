import { User } from '../domain/User';
import { IUserStore } from '../domain/repositories/IUserStore';

export class InMemoryUserStore implements IUserStore {
  private store = new Map<string, User>();

  async find(discordUserId: string): Promise<User | undefined> {
    return this.store.get(discordUserId);
  }

  async save(user: User): Promise<void> {
    this.store.set(user.discordUserId, user);
  }

  async delete(discordUserId: string): Promise<void> {
    this.store.delete(discordUserId);
  }
}
