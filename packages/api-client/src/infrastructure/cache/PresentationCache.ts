import { promises as fs } from 'fs';
import path from 'path';
import { PresentationsResponse } from '../../domain/entities';

interface CacheEntry {
  expiresAt: number;
  data: PresentationsResponse;
}

export interface PresentationCacheOptions {
  filePath: string;
  ttlMs: number;
  enabled: boolean;
}

export class PresentationCache {
  private cache = new Map<number, CacheEntry>();
  private isLoaded = false;
  private readonly filePath: string;
  private readonly ttlMs: number;
  private readonly enabled: boolean;

  constructor(options: PresentationCacheOptions) {
    this.filePath = options.filePath;
    this.ttlMs = Math.max(options.ttlMs, 0);
    this.enabled = options.enabled;
  }

  async get(eventId: number): Promise<PresentationsResponse | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    await this.ensureLoaded();
    const entry = this.cache.get(eventId);
    if (!entry) {
      return undefined;
    }

    if (this.ttlMs === 0 || Date.now() <= entry.expiresAt) {
      return entry.data;
    }

    this.cache.delete(eventId);
    await this.persist();
    return undefined;
  }

  async set(eventId: number, data: PresentationsResponse): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.ensureLoaded();
    const expiresAt = this.ttlMs === 0 ? Number.MAX_SAFE_INTEGER : Date.now() + this.ttlMs;
    this.cache.set(eventId, { data, expiresAt });
    await this.persist();
  }

  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.cache.clear();
    await this.persist();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded || !this.enabled) {
      return;
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed)) {
        const eventId = Number(key);
        if (!Number.isFinite(eventId)) {
          continue;
        }
        if (this.ttlMs === 0 || entry.expiresAt > now) {
          this.cache.set(eventId, entry);
        }
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn('[api-client] Failed to load presentation cache:', error?.message ?? error);
      }
    } finally {
      this.isLoaded = true;
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const serializable: Record<string, CacheEntry> = {};
    for (const [eventId, entry] of this.cache.entries()) {
      serializable[String(eventId)] = entry;
    }

    await fs.writeFile(this.filePath, JSON.stringify(serializable, null, 2), 'utf-8');
  }
}
