import { User } from '../User';

export interface IUserStore {
  find(discordUserId: string): Promise<User | undefined>;
  save(user: User): Promise<void>;
  delete(discordUserId: string): Promise<void>;
}
