import { IGroupRepository } from '../../domain/repositories';
import { GroupSearchParams, GroupsResponse } from '../../domain/entities';
import { HttpClient } from '../http/HttpClient';
import { Validators } from '../../domain/utils/validators';

export class GroupRepository implements IGroupRepository {
  constructor(private httpClient: HttpClient) {}

  async searchGroups(params: GroupSearchParams): Promise<GroupsResponse> {
    Validators.validateGroupSearchParams(params);
    const queryParams = this.buildGroupQueryParams(params);
    const response = await this.httpClient.get<GroupsResponse>('/groups/', queryParams);
    return response.data;
  }

  private buildGroupQueryParams(params: GroupSearchParams): Record<string, any> {
    const queryParams: Record<string, any> = {};

    if (params.groupId) queryParams.group_id = params.groupId.join(',');
    if (params.keyword) queryParams.keyword = params.keyword;
    if (params.countryCode) queryParams.country_code = params.countryCode;
    if (params.prefecture) queryParams.prefecture = params.prefecture;
    if (params.count) queryParams.count = params.count;
    if (params.order) queryParams.order = params.order;
    if (params.start) queryParams.start = params.start;

    return queryParams;
  }
}