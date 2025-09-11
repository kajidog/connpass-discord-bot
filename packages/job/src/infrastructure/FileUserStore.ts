import { promises as fs } from 'fs';
import path from 'path';
import { User } from '../domain/User';
import { IUserStore } from '../domain/repositories/IUserStore';

type UserStoreData = {
  [discordUserId: string]: User;
};

export class FileUserStore implements IUserStore {
  private readonly filePath: string;

  constructor(private readonly dir: string) {
    this.filePath = path.join(dir, 'users.json');
  }

  private async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private async readStore(): Promise<UserStoreData> {
    try {
      await this.ensureDir();
      const raw = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch (e: any) {
      if (e?.code === 'ENOENT') return {};
      throw e;
    }
  }

  private async writeStore(data: UserStoreData): Promise<void> {
    await this.ensureDir();
    const tmpPath = `${this.filePath}.tmp`;
    const raw = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, raw, 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  async find(discordUserId: string): Promise<User | undefined> {
    const store = await this.readStore();
    return store[discordUserId];
  }

  async save(user: User): Promise<void> {
    const store = await this.readStore();
    store[user.discordUserId] = user;
    await this.writeStore(store);
  }

  async delete(discordUserId: string): Promise<void> {
    const store = await this.readStore();
    delete store[discordUserId];
    await this.writeStore(store);
  }
}
