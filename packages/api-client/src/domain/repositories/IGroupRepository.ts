import { GroupSearchParams, GroupsResponse } from '../entities';

export interface IGroupRepository {
  searchGroups(params: GroupSearchParams): Promise<GroupsResponse>;
}