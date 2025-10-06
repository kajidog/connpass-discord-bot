import { UserSearchParams, UsersResponse, GroupsResponse, EventsResponse } from '../entities';

export interface IUserRepository {
  searchUsers(params: UserSearchParams): Promise<UsersResponse>;
  getUserGroups(nickname: string, params?: { count?: number; start?: number }): Promise<GroupsResponse>;
  getUserAttendedEvents(
    nickname: string,
    params?: { count?: number; order?: 1 | 2 | 3; start?: number }
  ): Promise<EventsResponse>;
  getUserPresenterEvents(
    nickname: string,
    params?: { count?: number; order?: 1 | 2 | 3; start?: number }
  ): Promise<EventsResponse>;
}
