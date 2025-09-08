import { IUserRepository } from '../../domain/repositories';
import { UserSearchParams, UsersResponse, GroupsResponse, EventsResponse } from '../../domain/entities';

export class UserService {
  constructor(private userRepository: IUserRepository) {}

  async searchUsers(params: UserSearchParams = {}): Promise<UsersResponse> {
    return this.userRepository.searchUsers(params);
  }

  async getUserGroups(userId: number, params?: { count?: number; start?: number }): Promise<GroupsResponse> {
    if (userId <= 0) {
      throw new Error('User ID must be a positive number');
    }
    return this.userRepository.getUserGroups(userId, params);
  }

  async getUserAttendedEvents(userId: number, params?: { count?: number; order?: 1 | 2 | 3; start?: number }): Promise<EventsResponse> {
    if (userId <= 0) {
      throw new Error('User ID must be a positive number');
    }
    return this.userRepository.getUserAttendedEvents(userId, params);
  }

  async getUserPresenterEvents(userId: number, params?: { count?: number; order?: 1 | 2 | 3; start?: number }): Promise<EventsResponse> {
    if (userId <= 0) {
      throw new Error('User ID must be a positive number');
    }
    return this.userRepository.getUserPresenterEvents(userId, params);
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
    }

    return allUsers;
  }
}