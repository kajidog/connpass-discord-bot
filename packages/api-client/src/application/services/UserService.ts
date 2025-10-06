import { IUserRepository } from '../../domain/repositories';
import { UserSearchParams, UsersResponse, GroupsResponse, EventsResponse } from '../../domain/entities';

export class UserService {
  private readonly nicknameCache = new Map<number, string>();

  constructor(private userRepository: IUserRepository) {}

  async searchUsers(params: UserSearchParams = {}): Promise<UsersResponse> {
    return this.userRepository.searchUsers(params);
  }

  async getUserGroups(
    userIdOrNickname: number | string,
    params?: { count?: number; start?: number }
  ): Promise<GroupsResponse> {
    const nickname = await this.resolveUserNickname(userIdOrNickname);
    return this.userRepository.getUserGroups(nickname, params);
  }

  async getUserAttendedEvents(
    userIdOrNickname: number | string,
    params?: { count?: number; order?: 1 | 2 | 3; start?: number }
  ): Promise<EventsResponse> {
    const nickname = await this.resolveUserNickname(userIdOrNickname);
    return this.userRepository.getUserAttendedEvents(nickname, params);
  }

  async getUserPresenterEvents(
    userIdOrNickname: number | string,
    params?: { count?: number; order?: 1 | 2 | 3; start?: number }
  ): Promise<EventsResponse> {
    const nickname = await this.resolveUserNickname(userIdOrNickname);
    return this.userRepository.getUserPresenterEvents(nickname, params);
  }

  async getAllUsers(params: Omit<UserSearchParams, 'start' | 'count'> = {}): Promise<UsersResponse> {
    const allUsers: UsersResponse = {
      usersReturned: 0,
      usersAvailable: 0,
      usersStart: 1,
      users: [],
    };

    let start = 1;
    const count = 100;

    while (true) {
      const response = await this.searchUsers({ ...params, start, count });

      if (allUsers.usersAvailable === 0) {
        allUsers.usersAvailable = response.usersAvailable;
        allUsers.usersStart = response.usersStart;
      }

      allUsers.users.push(...response.users);
      allUsers.usersReturned += response.usersReturned;

      if (response.usersReturned < count || allUsers.users.length >= response.usersAvailable) {
        break;
      }

      start += count;

      // Wait 1 second to respect API rate limit (1 request per second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allUsers;
  }

  private async resolveUserNickname(userIdOrNickname: number | string): Promise<string> {
    if (typeof userIdOrNickname === 'string') {
      const nickname = userIdOrNickname.trim();
      if (!nickname) {
        throw new Error('Nickname must be a non-empty string');
      }
      return nickname;
    }

    if (!Number.isFinite(userIdOrNickname) || userIdOrNickname <= 0) {
      throw new Error('User ID must be a positive number');
    }

    const userId = Math.trunc(userIdOrNickname);
    const cachedNickname = this.nicknameCache.get(userId);
    if (cachedNickname) {
      return cachedNickname;
    }

    const response = await this.userRepository.searchUsers({ userId: [userId], count: 1 });
    const user = response.users.find((candidate) => candidate.id === userId);

    if (!user) {
      throw new Error(`User with ID ${userId} was not found`);
    }

    this.nicknameCache.set(userId, user.nickname);
    return user.nickname;
  }
}
