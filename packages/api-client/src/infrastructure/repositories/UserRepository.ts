import { IUserRepository } from '../../domain/repositories';
import { UserSearchParams, UsersResponse, GroupsResponse, EventsResponse } from '../../domain/entities';
import { HttpClient } from '../http/HttpClient';
import { Validators } from '../../domain/utils/validators';

export class UserRepository implements IUserRepository {
  constructor(private httpClient: HttpClient) {}

  async searchUsers(params: UserSearchParams): Promise<UsersResponse> {
    Validators.validateUserSearchParams(params);
    const queryParams = this.buildUserQueryParams(params);
    const response = await this.httpClient.get<UsersResponse>('/users/', queryParams);
    return response.data;
  }

  async getUserGroups(nickname: string, params?: { count?: number; start?: number }): Promise<GroupsResponse> {
    Validators.validateNickname(nickname, 'nickname');
    const queryParams: Record<string, any> = {};
    if (params?.count) queryParams.count = params.count;
    if (params?.start) queryParams.start = params.start;

    const encodedNickname = encodeURIComponent(nickname.trim());
    const response = await this.httpClient.get<GroupsResponse>(
      `/users/${encodedNickname}/groups/`,
      queryParams
    );
    return response.data;
  }

  async getUserAttendedEvents(
    nickname: string,
    params?: { count?: number; order?: 1 | 2 | 3; start?: number }
  ): Promise<EventsResponse> {
    Validators.validateNickname(nickname, 'nickname');
    const queryParams: Record<string, any> = {};
    if (params?.count) queryParams.count = params.count;
    if (params?.order) queryParams.order = params.order;
    if (params?.start) queryParams.start = params.start;

    const encodedNickname = encodeURIComponent(nickname.trim());
    const response = await this.httpClient.get<EventsResponse>(
      `/users/${encodedNickname}/attended_events/`,
      queryParams
    );
    return response.data;
  }

  async getUserPresenterEvents(
    nickname: string,
    params?: { count?: number; order?: 1 | 2 | 3; start?: number }
  ): Promise<EventsResponse> {
    Validators.validateNickname(nickname, 'nickname');
    const queryParams: Record<string, any> = {};
    if (params?.count) queryParams.count = params.count;
    if (params?.order) queryParams.order = params.order;
    if (params?.start) queryParams.start = params.start;

    const encodedNickname = encodeURIComponent(nickname.trim());
    const response = await this.httpClient.get<EventsResponse>(
      `/users/${encodedNickname}/presenter_events/`,
      queryParams
    );
    return response.data;
  }

  private buildUserQueryParams(params: UserSearchParams): Record<string, any> {
    const queryParams: Record<string, any> = {};

    if (params.userId) queryParams.user_id = params.userId.join(',');
    if (params.nickname) queryParams.nickname = params.nickname;
    if (params.count) queryParams.count = params.count;
    if (params.order) queryParams.order = params.order;
    if (params.start) queryParams.start = params.start;

    return queryParams;
  }
}
