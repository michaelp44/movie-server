import { logger } from '../logger.js';
import { jellyfinService } from './jellyfin.service.js';
import type {
  MediaItem,
  MediaLibrary,
  MediaServerHealth,
  MediaServerSource,
  ViewingHistoryItem,
  WatchedMediaFile,
} from './media-server.types.js';
import { plexService, type PlexMediaItem, type PlexViewingHistoryItem } from './plex.service.js';

function withPlexSource(item: PlexMediaItem): MediaItem {
  return {
    ...item,
    source: 'plex',
  };
}

function withPlexHistorySource(item: PlexViewingHistoryItem): ViewingHistoryItem {
  return {
    ...withPlexSource(item),
    viewedAt: item.viewedAt,
  };
}

class MediaServerService {
  isAnyEnabled(): boolean {
    return plexService.isEnabled() || jellyfinService.isEnabled();
  }

  async getLibraries(): Promise<MediaLibrary[]> {
    const [plexLibraries, jellyfinLibraries] = await Promise.all([
      plexService.getLibraries().then((libraries) => libraries.map((library) => ({
        ...library,
        source: 'plex' as const,
      }))),
      jellyfinService.getLibraries(),
    ]);

    return [...plexLibraries, ...jellyfinLibraries];
  }

  async scanAllLibraries(): Promise<void> {
    await Promise.all([
      plexService.scanAllLibraries(),
      jellyfinService.scanAllLibraries(),
    ]);
  }

  async getWatchedFiles(): Promise<WatchedMediaFile[]> {
    const [plexWatchedFiles, jellyfinWatchedFiles] = await Promise.all([
      plexService.getWatchedFiles().then((files) => files.map((file) => ({
        ...file,
        source: 'plex' as const,
      }))),
      jellyfinService.getWatchedFiles(),
    ]);

    return [...plexWatchedFiles, ...jellyfinWatchedFiles];
  }

  async getAllMediaMetadata(): Promise<MediaItem[]> {
    const [plexItems, jellyfinItems] = await Promise.all([
      plexService.getAllMediaMetadata().then((items) => items.map(withPlexSource)),
      jellyfinService.getAllMediaMetadata(),
    ]);

    return [...plexItems, ...jellyfinItems];
  }

  async getViewingHistory(limit = 100): Promise<ViewingHistoryItem[]> {
    const [plexHistory, jellyfinHistory] = await Promise.all([
      plexService.getViewingHistory(limit).then((items) => items.map(withPlexHistorySource)),
      jellyfinService.getViewingHistory(limit),
    ]);

    return [...plexHistory, ...jellyfinHistory]
      .sort((a, b) => (b.viewedAt ?? b.lastViewedAt ?? 0) - (a.viewedAt ?? a.lastViewedAt ?? 0))
      .slice(0, limit);
  }

  async getRelatedMedia(item: ViewingHistoryItem): Promise<MediaItem[]> {
    if (item.source === 'jellyfin') {
      return await jellyfinService.getRelatedMedia(item.ratingKey);
    }

    return await plexService.getRelatedMedia(item.ratingKey).then((items) => items.map(withPlexSource));
  }

  async getImage(source: MediaServerSource, imagePath: string): Promise<{ bytes: Buffer; contentType: string } | undefined> {
    if (source === 'jellyfin') {
      return await jellyfinService.getImage(imagePath);
    }

    return await plexService.getImage(imagePath);
  }

  async healthCheck(): Promise<MediaServerHealth[]> {
    const [plexHealth, jellyfinHealth] = await Promise.all([
      plexService.healthCheck(),
      jellyfinService.healthCheck(),
    ]);

    return [
      {
        source: 'plex',
        enabled: plexService.isEnabled(),
        connected: plexHealth.connected,
        serverName: plexHealth.serverName,
      },
      {
        source: 'jellyfin',
        enabled: jellyfinService.isEnabled(),
        connected: jellyfinHealth.connected,
        serverName: jellyfinHealth.serverName,
      },
    ];
  }

  logEnabledState(): void {
    logger.info({
      plexEnabled: plexService.isEnabled(),
      jellyfinEnabled: jellyfinService.isEnabled(),
    }, 'Media server integrations loaded');
  }
}

export const mediaServerService = new MediaServerService();
