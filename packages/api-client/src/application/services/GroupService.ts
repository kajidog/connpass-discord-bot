import { IGroupRepository } from '../../domain/repositories';
import { GroupSearchParams, GroupsResponse } from '../../domain/entities';

export class GroupService {
  constructor(private groupRepository: IGroupRepository) {}

  async searchGroups(params: GroupSearchParams = {}): Promise<GroupsResponse> {
    return this.groupRepository.searchGroups(params);
  }

  async getAllGroups(params: Omit<GroupSearchParams, 'start' | 'count'> = {}): Promise<GroupsResponse> {
    const allGroups: GroupsResponse = {
      groupsReturned: 0,
      groupsAvailable: 0,
      groupsStart: 1,
      groups: [],
    };

    let start = 1;
    const count = 100;

    while (true) {
      const response = await this.searchGroups({ ...params, start, count });

      if (allGroups.groupsAvailable === 0) {
        allGroups.groupsAvailable = response.groupsAvailable;
        allGroups.groupsStart = response.groupsStart;
      }

      allGroups.groups.push(...response.groups);
      allGroups.groupsReturned += response.groupsReturned;

      if (response.groupsReturned < count || allGroups.groups.length >= response.groupsAvailable) {
        break;
      }

      start += count;

      // Wait 1 second to respect API rate limit (1 request per second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allGroups;
  }
}