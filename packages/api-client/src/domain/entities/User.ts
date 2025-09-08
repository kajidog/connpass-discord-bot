export interface User {
  id: number;
  nickname: string;
  displayName: string;
  twitterUsername?: string;
  githubUsername?: string;
  url?: string;
  updatedAt: string;
}

export interface UserSearchParams {
  userId?: number[];
  nickname?: string;
  count?: number;
  order?: 1 | 2 | 3;
  start?: number;
}

export interface UsersResponse {
  usersReturned: number;
  usersAvailable: number;
  usersStart: number;
  users: User[];
}