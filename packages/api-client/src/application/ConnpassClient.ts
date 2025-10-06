import path from 'path';
import { HttpClient } from '../infrastructure/http/HttpClient';
import { EventRepository, GroupRepository, UserRepository } from '../infrastructure/repositories';
import { EventService, GroupService, UserService } from './services';
import {
  EventSearchParams,
  EventsResponse,
  PresentationsResponse,
  GroupSearchParams,
  GroupsResponse,
  UserSearchParams,
  UsersResponse,
} from '../domain/entities';
import { PresentationCache } from '../infrastructure/cache/PresentationCache';

export interface ConnpassClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  rateLimitDelay?: number;
  enablePresentationCache?: boolean;
  presentationCacheTtlMs?: number;
  presentationCachePath?: string;
}

export class ConnpassClient {
  private readonly eventService: EventService;
  private readonly groupService: GroupService;
  private readonly userService: UserService;

  constructor(config: ConnpassClientConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    const httpClient = new HttpClient({
      baseURL: config.baseURL ?? 'https://connpass.com/api/v2',
      apiKey: config.apiKey,
      timeout: config.timeout,
      rateLimitDelay: config.rateLimitDelay,
    });

    const presentationCache = new PresentationCache({
      enabled: this.resolveCacheEnabled(config.enablePresentationCache),
      ttlMs: this.resolveCacheTtl(config.presentationCacheTtlMs),
      filePath: this.resolveCachePath(config.presentationCachePath),
    });

    const eventRepository = new EventRepository(httpClient, presentationCache);
    const groupRepository = new GroupRepository(httpClient);
    const userRepository = new UserRepository(httpClient);

    this.eventService = new EventService(eventRepository);
    this.groupService = new GroupService(groupRepository);
    this.userService = new UserService(userRepository);
  }

  async searchEvents(params: EventSearchParams = {}): Promise<EventsResponse> {
    return this.eventService.searchEvents(params);
  }

  async getAllEvents(params: Omit<EventSearchParams, 'start' | 'count'> = {}): Promise<EventsResponse> {
    return this.eventService.getAllEvents(params);
  }

  async getEventPresentations(eventId: number): Promise<PresentationsResponse> {
    return this.eventService.getEventPresentations(eventId);
  }

  async searchGroups(params: GroupSearchParams = {}): Promise<GroupsResponse> {
    return this.groupService.searchGroups(params);
  }

  async getAllGroups(params: Omit<GroupSearchParams, 'start' | 'count'> = {}): Promise<GroupsResponse> {
    return this.groupService.getAllGroups(params);
  }

  async searchUsers(params: UserSearchParams = {}): Promise<UsersResponse> {
    return this.userService.searchUsers(params);
  }

  async getAllUsers(params: Omit<UserSearchParams, 'start' | 'count'> = {}): Promise<UsersResponse> {
    return this.userService.getAllUsers(params);
  }

  async getUserGroups(userId: number, params?: { count?: number; start?: number }): Promise<GroupsResponse> {
    return this.userService.getUserGroups(userId, params);
  }

  async getUserAttendedEvents(userId: number, params?: { count?: number; order?: 1 | 2 | 3; start?: number }): Promise<EventsResponse> {
    return this.userService.getUserAttendedEvents(userId, params);
  }

  async getUserPresenterEvents(userId: number, params?: { count?: number; order?: 1 | 2 | 3; start?: number }): Promise<EventsResponse> {
    return this.userService.getUserPresenterEvents(userId, params);
  }

  private resolveCacheEnabled(explicit?: boolean): boolean {
    if (typeof explicit === 'boolean') {
      return explicit;
    }

    const raw = process.env.CONNPASS_PRESENTATION_CACHE_ENABLED;
    if (raw === undefined) {
      return true;
    }

    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }

    return true;
  }

  private resolveCacheTtl(explicit?: number): number {
    if (typeof explicit === 'number' && explicit >= 0) {
      return explicit;
    }

    const fromEnv = process.env.CONNPASS_PRESENTATION_CACHE_TTL_MS;
    if (fromEnv) {
      const parsed = Number(fromEnv);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    // default: 1 hour
    return 60 * 60 * 1000;
  }

  private resolveCachePath(explicit?: string): string {
    if (explicit?.trim()) {
      return explicit;
    }

    const fromEnv = process.env.CONNPASS_PRESENTATION_CACHE_PATH;
    if (fromEnv?.trim()) {
      return fromEnv;
    }

    return path.join(process.cwd(), 'data', 'presentation-cache.json');
  }
}
