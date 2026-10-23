export type MediaServerSource = 'plex' | 'jellyfin';

export interface MediaLibrary {
  key: string;
  title: string;
  type: string;
  source: MediaServerSource;
}

export interface MediaItem {
  ratingKey: string;
  guid?: string;
  source: MediaServerSource;
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

export interface ViewingHistoryItem extends MediaItem {
  viewedAt?: number;
}

export interface MediaServerHealth {
  source: MediaServerSource;
  enabled: boolean;
  connected: boolean;
  serverName?: string;
}

export interface WatchedMediaFile {
  file: string;
  title: string;
  lastViewedAt?: number;
  source: MediaServerSource;
}
