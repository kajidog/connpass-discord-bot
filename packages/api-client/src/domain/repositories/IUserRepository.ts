import { UserSearchParams, UsersResponse, GroupsResponse, EventsResponse } from '../entities';

export interface IUserRepository {
  searchUsers(params: UserSearchParams): Promise<UsersResponse>;
  getUserGroups(userId: number, params?: { count?: number; start?: number }): Promise<GroupsResponse>;
  getUserAttendedEvents(userId: number, params?: { count?: number; order?: 1 | 2 | 3; start?: number }): Promise<EventsResponse>;
  getUserPresenterEvents(userId: number, params?: { count?: number; order?: 1 | 2 | 3; start?: number }): Promise<EventsResponse>;
}