export interface Group {
  id: number;
  title: string;
  description: string;
  url: string;
  countryCode: string;
  prefecture: string;
  place: string;
  lat?: number;
  lon?: number;
  updatedAt: string;
}

export interface GroupSearchParams {
  groupId?: number[];
  keyword?: string;
  countryCode?: string;
  prefecture?: string;
  count?: number;
  order?: 1 | 2 | 3;
  start?: number;
}

export interface GroupsResponse {
  groupsReturned: number;
  groupsAvailable: number;
  groupsStart: number;
  groups: Group[];
}