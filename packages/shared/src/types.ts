// Download status states
export const DOWNLOAD_STATUS = {
  QUEUED: 'QUEUED',
  FETCHING_MAGNET: 'FETCHING_MAGNET',
  ADDING_TO_QBITTORRENT: 'ADDING_TO_QBITTORRENT',
  DOWNLOADING: 'DOWNLOADING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
} as const;

export type DownloadStatus = (typeof DOWNLOAD_STATUS)[keyof typeof DOWNLOAD_STATUS];

// Download model
export interface Download {
  id: string;
  name: string;
  status: DownloadStatus;
  progress: number; // 0-100
  eta: number | null; // seconds remaining
  sizeBytes: number | null;
  downloadedBytes: number;
  savePath: string | null;
  createdAt: string;
  updatedAt: string;
  sourceProvider: string;
  sourceId: string;
  errorMessage?: string;
}

export interface AdminDownload extends Download {
  userId: string;
  username: string;
}

export type WantedDownloadStatus = 'ACTIVE' | 'DOWNLOADED' | 'CANCELED' | 'FAILED';
export type WantedDownloadQuality = '720p' | '1080p' | '2160p';

export interface WantedDownload {
  id: string;
  title: string;
  year?: number;
  mediaType: 'movie' | 'show';
  minQuality: WantedDownloadQuality;
  status: WantedDownloadStatus;
  lastCheckedAt?: string;
  lastError?: string;
  matchedTitle?: string;
  matchedQuality?: string;
  downloadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WantedDownloadAvailability {
  itemId: string;
  title: string;
  year?: number;
  hasGoodQuality: boolean;
  alreadyWanted: boolean;
  canAddWanted: boolean;
  matchedTitle?: string;
  matchedQuality?: string;
}

// Library file model
export interface LibraryFile {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  downloadId?: string;
}

// Recommendation models
export interface RecommendationItem {
  id: string;
  title: string;
  type: 'movie' | 'show' | 'episode' | 'file' | 'download';
  year?: number;
  rating?: number;
  genres: string[];
  reason?: string;
  posterUrl?: string;
  overview?: string;
  externalUrl?: string;
  durationMs?: number;
  watchedAt?: string;
  viewCount?: number;
  progressPercent?: number;
  filePath?: string;
  source: 'plex' | 'jellyfin' | 'tmdb' | 'library' | 'download';
}

export interface RecommendationSection {
  id: string;
  title: string;
  reason?: string;
  items: RecommendationItem[];
}

// Search result from provider
export interface ProviderSearchResult {
  id: string;
  title: string;
  sizeBytes: number | null;
  seeds: number | null;
  peers: number | null;
  provider: string;
  year?: number;
  quality?: string;
  compatibility?: {
    score: number;
    level: 'best' | 'ok' | 'risky';
    label: string;
    reasons: string[];
  };
}

// User model (without password)
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface AdminOverview {
  users: User[];
  downloads: AdminDownload[];
  settings: {
    signupEnabled: boolean;
  };
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

// WebSocket message types
export const WS_MESSAGE_TYPES = {
  DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
  DOWNLOAD_STATUS_CHANGE: 'DOWNLOAD_STATUS_CHANGE',
  DOWNLOAD_COMPLETED: 'DOWNLOAD_COMPLETED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  ERROR: 'ERROR',
} as const;

export type WsMessageType = (typeof WS_MESSAGE_TYPES)[keyof typeof WS_MESSAGE_TYPES];

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
}

export interface DownloadProgressPayload {
  downloadId: string;
  progress: number;
  downloadedBytes: number;
  eta: number | null;
  downloadSpeed: number;
  uploadSpeed: number;
}

export interface DownloadStatusChangePayload {
  downloadId: string;
  status: DownloadStatus;
  errorMessage?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
