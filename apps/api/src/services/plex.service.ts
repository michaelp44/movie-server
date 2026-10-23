import { config } from '../config.js';
import { logger } from '../logger.js';

const PLEX_HEALTH_TIMEOUT_MS = 800;

/**
 * Plex Media Server integration service.
 * Triggers library scans when new content is added.
 */

interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

interface PlexTag {
  tag?: string;
}

interface PlexMediaPart {
  file?: string;
}

interface PlexMediaContainerItem {
  ratingKey: string;
  guid?: string;
  type?: string;
  title: string;
  grandparentTitle?: string;
  parentTitle?: string;
  year?: number;
  summary?: string;
  thumb?: string;
  duration?: number;
  viewCount?: number;
  lastViewedAt?: number;
  viewedAt?: number;
  viewOffset?: number;
  audienceRating?: number;
  rating?: number;
  librarySectionKey?: string;
  Genre?: PlexTag[];
  Director?: PlexTag[];
  Writer?: PlexTag[];
  Role?: PlexTag[];
  Media?: Array<{
    Part?: PlexMediaPart[];
  }>;
}

export interface PlexMediaItem {
  ratingKey: string;
  guid?: string;
  type: 'movie' | 'show' | 'episode' | 'other';
  title: string;
  showTitle?: string;
  seasonTitle?: string;
  year?: number;
  summary?: string;
  thumb?: string;
  durationMs?: number;
  viewCount: number;
  lastViewedAt?: number;
  viewOffsetMs?: number;
  rating?: number;
  genres: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  file?: string;
  librarySectionKey?: string;
}

export interface PlexViewingHistoryItem extends PlexMediaItem {
  viewedAt?: number;
}

class PlexService {
  private baseUrl: string;
  private token: string;
  private enabled: boolean;

  constructor() {
    this.baseUrl = config.plex.host;
    this.token = config.plex.token;
    this.enabled = config.plex.enabled;
  }

  /**
   * Check if Plex integration is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.token;
  }

  private buildUrl(path: string, params: Record<string, string> = {}): string {
    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path.replace(/^\//, ''), normalizedBase);
    url.searchParams.set('X-Plex-Token', this.token);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private async getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const response = await fetch(this.buildUrl(path, params), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  }

  private tagsToStrings(tags?: PlexTag[]): string[] {
    return (tags ?? [])
      .map((entry) => entry.tag)
      .filter((tag): tag is string => Boolean(tag));
  }

  private plexTypeToMediaType(type?: string): PlexMediaItem['type'] {
    if (type === 'movie' || type === 'show' || type === 'episode') {
      return type;
    }
    return 'other';
  }

  private metadataToMediaItem(item: PlexMediaContainerItem): PlexMediaItem {
    return {
      ratingKey: item.ratingKey,
      guid: item.guid,
      type: this.plexTypeToMediaType(item.type),
      title: item.title,
      showTitle: item.grandparentTitle,
      seasonTitle: item.parentTitle,
      year: item.year,
      summary: item.summary,
      thumb: item.thumb,
      durationMs: item.duration,
      viewCount: item.viewCount ?? 0,
      lastViewedAt: item.lastViewedAt,
      viewOffsetMs: item.viewOffset,
      rating: item.audienceRating ?? item.rating,
      genres: this.tagsToStrings(item.Genre),
      directors: this.tagsToStrings(item.Director),
      writers: this.tagsToStrings(item.Writer),
      actors: this.tagsToStrings(item.Role),
      file: item.Media?.[0]?.Part?.[0]?.file,
      librarySectionKey: item.librarySectionKey,
    };
  }

  /**
   * Get all library sections from Plex
   */
  async getLibraries(): Promise<PlexLibrary[]> {
    if (!this.isEnabled()) {
      logger.debug('Plex integration disabled, skipping getLibraries');
      return [];
    }

    try {
      const data = await this.getJson<{
        MediaContainer?: {
          Directory?: Array<{ key: string; title: string; type: string }>;
        };
      }>('/library/sections');

      const directories = data.MediaContainer?.Directory ?? [];
      return directories.map((dir) => ({
        key: dir.key,
        title: dir.title,
        type: dir.type,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get Plex libraries');
      throw error;
    }
  }

  /**
   * Trigger a library scan for a specific section
   */
  async scanLibrary(sectionKey: string): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug('Plex integration disabled, skipping scanLibrary');
      return;
    }

    try {
      logger.info({ sectionKey }, 'Triggering Plex library scan');

      const response = await fetch(this.buildUrl(`/library/sections/${sectionKey}/refresh`));

      if (!response.ok) {
        throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
      }

      logger.info({ sectionKey }, 'Plex library scan triggered successfully');
    } catch (error) {
      logger.error({ error, sectionKey }, 'Failed to trigger Plex library scan');
      throw error;
    }
  }

  /**
   * Scan all libraries (movies and TV shows)
   */
  async scanAllLibraries(): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug('Plex integration disabled, skipping scanAllLibraries');
      return;
    }

    try {
      const libraries = await this.getLibraries();
      const mediaLibraries = libraries.filter(
        (lib) => lib.type === 'movie' || lib.type === 'show'
      );

      logger.info({ count: mediaLibraries.length }, 'Scanning Plex media libraries');

      await Promise.all(
        mediaLibraries.map((lib) => this.scanLibrary(lib.key))
      );

      logger.info('All Plex library scans triggered');
    } catch (error) {
      logger.error({ error }, 'Failed to scan all Plex libraries');
      // Don't throw - we don't want to fail the download completion
    }
  }

  /**
   * Get all media items from a library section with their watched status
   */
  async getLibraryItems(sectionKey: string): Promise<Array<{ ratingKey: string; title: string; viewCount: number; lastViewedAt?: number; file?: string }>> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const data = await this.getJson<{
        MediaContainer?: {
          Metadata?: Array<{
            ratingKey: string;
            title: string;
            viewCount?: number;
            lastViewedAt?: number;
            Media?: Array<{
              Part?: Array<{ file?: string }>;
            }>;
          }>;
        };
      }>(`/library/sections/${sectionKey}/all`);

      const metadata = data.MediaContainer?.Metadata ?? [];
      return metadata.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        viewCount: item.viewCount ?? 0,
        lastViewedAt: item.lastViewedAt,
        file: item.Media?.[0]?.Part?.[0]?.file,
      }));
    } catch (error) {
      logger.error({ error, sectionKey }, 'Failed to get Plex library items');
      return [];
    }
  }

  /**
   * Get all watched media files from Plex
   * Returns file paths that have been watched (viewCount > 0)
   */
  async getWatchedFiles(): Promise<Array<{ file: string; title: string; lastViewedAt?: number }>> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const libraries = await this.getLibraries();
      const mediaLibraries = libraries.filter(
        (lib) => lib.type === 'movie' || lib.type === 'show'
      );

      const watchedFiles: Array<{ file: string; title: string; lastViewedAt?: number }> = [];

      for (const lib of mediaLibraries) {
        const items = await this.getLibraryItems(lib.key);
        for (const item of items) {
          if (item.viewCount > 0 && item.file) {
            watchedFiles.push({
              file: item.file,
              title: item.title,
              lastViewedAt: item.lastViewedAt,
            });
          }
        }
      }

      return watchedFiles;
    } catch (error) {
      logger.error({ error }, 'Failed to get watched files from Plex');
      return [];
    }
  }

  /**
   * Get rich metadata for all movies and shows visible to this Plex token.
   */
  async getAllMediaMetadata(): Promise<PlexMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const libraries = await this.getLibraries();
      const mediaLibraries = libraries.filter(
        (lib) => lib.type === 'movie' || lib.type === 'show'
      );
      const mediaItems: PlexMediaItem[] = [];

      for (const lib of mediaLibraries) {
        const data = await this.getJson<{
          MediaContainer?: {
            Metadata?: PlexMediaContainerItem[];
          };
        }>(`/library/sections/${lib.key}/all`);

        const metadata = data.MediaContainer?.Metadata ?? [];
        mediaItems.push(
          ...metadata.map((item) => ({
            ...this.metadataToMediaItem(item),
            librarySectionKey: item.librarySectionKey ?? lib.key,
          }))
        );
      }

      return mediaItems;
    } catch (error) {
      logger.error({ error }, 'Failed to get Plex media metadata');
      return [];
    }
  }

  /**
   * Get recently watched history for the Plex account represented by the token.
   */
  async getViewingHistory(limit = 100): Promise<PlexViewingHistoryItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const data = await this.getJson<{
        MediaContainer?: {
          Metadata?: PlexMediaContainerItem[];
        };
      }>('/status/sessions/history/all', {
        sort: 'viewedAt:desc',
        'X-Plex-Container-Size': String(limit),
      });

      const metadata = data.MediaContainer?.Metadata ?? [];
      return metadata.map((item) => ({
        ...this.metadataToMediaItem(item),
        viewedAt: item.viewedAt,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get Plex viewing history');
      return [];
    }
  }

  /**
   * Ask Plex for related titles around a known movie/show/episode.
   * Plex may return only local-library items depending on server features, so callers still filter owned media.
   */
  async getRelatedMedia(ratingKey: string): Promise<PlexMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const data = await this.getJson<{
        MediaContainer?: {
          Metadata?: PlexMediaContainerItem[];
          Hub?: Array<{
            Metadata?: PlexMediaContainerItem[];
          }>;
        };
      }>(`/library/metadata/${ratingKey}/related`);

      const directMetadata = data.MediaContainer?.Metadata ?? [];
      const hubMetadata = (data.MediaContainer?.Hub ?? []).flatMap((hub) => hub.Metadata ?? []);

      return [...directMetadata, ...hubMetadata].map((item) => this.metadataToMediaItem(item));
    } catch (error) {
      logger.debug({ error, ratingKey }, 'Failed to get related Plex media');
      return [];
    }
  }

  async getImage(imagePath: string): Promise<{ bytes: Buffer; contentType: string } | undefined> {
    if (!this.isEnabled() || !imagePath.startsWith('/')) {
      return undefined;
    }

    try {
      const response = await fetch(this.buildUrl(imagePath));
      if (!response.ok) {
        return undefined;
      }

      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? 'image/jpeg',
      };
    } catch (error) {
      logger.error({ error, imagePath }, 'Failed to get Plex image');
      return undefined;
    }
  }

  /**
   * Check Plex server connectivity
   */
  async healthCheck(): Promise<{ connected: boolean; serverName?: string }> {
    if (!this.isEnabled()) {
      return { connected: false };
    }

    try {
      const response = await fetch(this.buildUrl('/'), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(PLEX_HEALTH_TIMEOUT_MS),
      });

      if (!response.ok) {
        return { connected: false };
      }

      const data = await response.json() as {
        MediaContainer?: { friendlyName?: string };
      };

      return {
        connected: true,
        serverName: data.MediaContainer?.friendlyName,
      };
    } catch {
      return { connected: false };
    }
  }
}

export const plexService = new PlexService();
