import { config } from '../config.js';
import { logger } from '../logger.js';
import type {
  MediaItem,
  MediaLibrary,
  ViewingHistoryItem,
  WatchedMediaFile,
} from './media-server.types.js';

const JELLYFIN_HEALTH_TIMEOUT_MS = 800;

interface JellyfinView {
  Id: string;
  Name: string;
  CollectionType?: string;
}

interface JellyfinPerson {
  Name?: string;
  Type?: string;
}

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeasonName?: string;
  ProductionYear?: number;
  Overview?: string;
  RunTimeTicks?: number;
  CommunityRating?: number;
  Path?: string;
  ParentId?: string;
  Genres?: string[];
  People?: JellyfinPerson[];
  ImageTags?: {
    Primary?: string;
  };
  UserData?: {
    PlayCount?: number;
    LastPlayedDate?: string;
    PlaybackPositionTicks?: number;
    Played?: boolean;
  };
}

class JellyfinService {
  private baseUrl: string;
  private apiKey: string;
  private userId: string;
  private enabled: boolean;

  constructor() {
    this.baseUrl = config.jellyfin.host;
    this.apiKey = config.jellyfin.apiKey;
    this.userId = config.jellyfin.userId;
    this.enabled = config.jellyfin.enabled;
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.apiKey) && Boolean(this.userId);
  }

  private buildUrl(path: string, params: Record<string, string> = {}): string {
    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path.replace(/^\//, ''), normalizedBase);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private async getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const response = await fetch(this.buildUrl(path, params), {
      headers: {
        Accept: 'application/json',
        'X-Emby-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  }

  private async post(path: string, params: Record<string, string> = {}): Promise<void> {
    const response = await fetch(this.buildUrl(path, params), {
      method: 'POST',
      headers: {
        'X-Emby-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`);
    }
  }

  private ticksToMs(ticks?: number): number | undefined {
    return ticks ? Math.round(ticks / 10000) : undefined;
  }

  private dateToSeconds(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : Math.floor(timestamp / 1000);
  }

  private jellyfinTypeToMediaType(type: string): MediaItem['type'] {
    if (type === 'Movie') {
      return 'movie';
    }

    if (type === 'Series') {
      return 'show';
    }

    if (type === 'Episode') {
      return 'episode';
    }

    return 'other';
  }

  private peopleByType(people: JellyfinPerson[] | undefined, type: string): string[] {
    return (people ?? [])
      .filter((person) => person.Type === type && person.Name)
      .map((person) => person.Name as string);
  }

  private itemToMediaItem(item: JellyfinItem): MediaItem {
    const lastViewedAt = this.dateToSeconds(item.UserData?.LastPlayedDate);

    return {
      ratingKey: item.Id,
      guid: item.Id,
      source: 'jellyfin',
      type: this.jellyfinTypeToMediaType(item.Type),
      title: item.Name,
      showTitle: item.SeriesName,
      seasonTitle: item.SeasonName,
      year: item.ProductionYear,
      summary: item.Overview,
      thumb: item.ImageTags?.Primary ? `/Items/${item.Id}/Images/Primary` : undefined,
      durationMs: this.ticksToMs(item.RunTimeTicks),
      viewCount: item.UserData?.PlayCount ?? 0,
      lastViewedAt,
      viewOffsetMs: this.ticksToMs(item.UserData?.PlaybackPositionTicks),
      rating: item.CommunityRating,
      genres: item.Genres ?? [],
      directors: this.peopleByType(item.People, 'Director'),
      writers: this.peopleByType(item.People, 'Writer'),
      actors: this.peopleByType(item.People, 'Actor'),
      file: item.Path,
      librarySectionKey: item.ParentId,
    };
  }

  async getLibraries(): Promise<MediaLibrary[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const data = await this.getJson<{ Items?: JellyfinView[] }>(`/Users/${this.userId}/Views`);
      return (data.Items ?? []).map((view) => ({
        key: view.Id,
        title: view.Name,
        type: view.CollectionType ?? 'unknown',
        source: 'jellyfin',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get Jellyfin libraries');
      return [];
    }
  }

  async scanAllLibraries(): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug('Jellyfin integration disabled, skipping scanAllLibraries');
      return;
    }

    try {
      await this.post('/Library/Refresh');
      logger.info('Jellyfin library scan triggered successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to trigger Jellyfin library scan');
    }
  }

  async getAllMediaMetadata(): Promise<MediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const items: MediaItem[] = [];
      let startIndex = 0;
      const limit = 200;

      while (true) {
        const data = await this.getJson<{ Items?: JellyfinItem[]; TotalRecordCount?: number }>(
          `/Users/${this.userId}/Items`,
          {
            Recursive: 'true',
            IncludeItemTypes: 'Movie,Series,Episode',
            Fields: 'Genres,People,Overview,Path,PremiereDate,CommunityRating,UserData,ImageTags,RunTimeTicks,ProductionYear',
            StartIndex: String(startIndex),
            Limit: String(limit),
          }
        );
        const batch = data.Items ?? [];
        items.push(...batch.map((item) => this.itemToMediaItem(item)));

        startIndex += batch.length;
        if (batch.length === 0 || startIndex >= (data.TotalRecordCount ?? 0)) {
          break;
        }
      }

      return items;
    } catch (error) {
      logger.error({ error }, 'Failed to get Jellyfin media metadata');
      return [];
    }
  }

  async getWatchedFiles(): Promise<WatchedMediaFile[]> {
    const items = await this.getAllMediaMetadata();

    return items
      .filter((item) => item.file && item.viewCount > 0)
      .map((item) => ({
        file: item.file as string,
        title: item.title,
        lastViewedAt: item.lastViewedAt,
        source: 'jellyfin',
      }));
  }

  async getViewingHistory(limit = 100): Promise<ViewingHistoryItem[]> {
    const items = await this.getAllMediaMetadata();

    return items
      .filter((item) => item.viewCount > 0 || Boolean(item.lastViewedAt))
      .sort((a, b) => (b.lastViewedAt ?? 0) - (a.lastViewedAt ?? 0))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        viewedAt: item.lastViewedAt,
      }));
  }

  async getRelatedMedia(itemId: string): Promise<MediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const data = await this.getJson<{ Items?: JellyfinItem[] }>(
        `/Items/${itemId}/Similar`,
        {
          UserId: this.userId,
          Limit: '24',
          Fields: 'Genres,People,Overview,Path,PremiereDate,CommunityRating,UserData,ImageTags,RunTimeTicks,ProductionYear',
        }
      );

      return (data.Items ?? []).map((item) => this.itemToMediaItem(item));
    } catch (error) {
      logger.debug({ error, itemId }, 'Failed to get related Jellyfin media');
      return [];
    }
  }

  async getImage(imagePath: string): Promise<{ bytes: Buffer; contentType: string } | undefined> {
    if (!this.isEnabled() || !imagePath.startsWith('/Items/')) {
      return undefined;
    }

    try {
      const response = await fetch(this.buildUrl(imagePath), {
        headers: {
          'X-Emby-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        return undefined;
      }

      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? 'image/jpeg',
      };
    } catch (error) {
      logger.error({ error, imagePath }, 'Failed to get Jellyfin image');
      return undefined;
    }
  }

  async healthCheck(): Promise<{ connected: boolean; serverName?: string }> {
    if (!this.isEnabled()) {
      return { connected: false };
    }

    try {
      const response = await fetch(this.buildUrl('/System/Info'), {
        headers: {
          Accept: 'application/json',
          'X-Emby-Token': this.apiKey,
        },
        signal: AbortSignal.timeout(JELLYFIN_HEALTH_TIMEOUT_MS),
      });

      if (!response.ok) {
        return { connected: false };
      }

      const data = await response.json() as { ServerName?: string };

      return {
        connected: true,
        serverName: data.ServerName,
      };
    } catch {
      return { connected: false };
    }
  }
}

export const jellyfinService = new JellyfinService();
