import { DEFAULTS, ALLOWED_UPLOAD_MIME_TYPES } from '@movie-server/shared';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${name}`);
  }
  return parsed;
}

function optionalEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const config = {
  // Server
  port: optionalEnvNumber('API_PORT', DEFAULTS.API_PORT),
  host: optionalEnv('API_HOST', '0.0.0.0'),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  
  // Security
  sessionSecret: requireEnv('SESSION_SECRET'),
  csrfSecret: requireEnv('CSRF_SECRET'),
  cookieSecure: optionalEnvBoolean('COOKIE_SECURE', process.env['NODE_ENV'] === 'production'),
  
  // Database
  dbPath: optionalEnv('DB_PATH', './data/movie-server.db'),
  
  // qBittorrent
  qbittorrentEnabled: optionalEnvBoolean('QBITTORRENT_ENABLED', true),
  qbittorrentHost: optionalEnv('QBITTORRENT_HOST', 'http://localhost'),
  qbittorrentPort: optionalEnvNumber('QBITTORRENT_PORT', DEFAULTS.QBITTORRENT_PORT),
  qbittorrentUsername: optionalEnv('QBITTORRENT_USERNAME', 'admin'),
  qbittorrentPassword: optionalEnv('QBITTORRENT_PASSWORD', 'adminadmin'),
  
  // Downloads
  downloadDir: optionalEnv('DOWNLOAD_DIR', './downloads'),
  pollIntervalMs: optionalEnvNumber('POLL_INTERVAL_MS', DEFAULTS.POLL_INTERVAL_MS),
  autoDownloadCheckIntervalMs: optionalEnvNumber('AUTO_DOWNLOAD_CHECK_INTERVAL_MS', 24 * 60 * 60 * 1000),
  plexCompatibleAudioEnabled: optionalEnvBoolean('PLEX_COMPATIBLE_AUDIO_ENABLED', false),
  plexCompatibleAudioArchiveDir: optionalEnv('PLEX_COMPATIBLE_AUDIO_ARCHIVE_DIR', ''),
  
  // Upload
  maxUploadSizeBytes: optionalEnvNumber('MAX_UPLOAD_SIZE_BYTES', DEFAULTS.MAX_UPLOAD_SIZE_BYTES),
  allowedUploadMimeTypes: ALLOWED_UPLOAD_MIME_TYPES as readonly string[],
  
  // Rate limiting
  rateLimitMax: optionalEnvNumber('RATE_LIMIT_MAX', DEFAULTS.RATE_LIMIT_MAX),
  rateLimitWindowMs: optionalEnvNumber('RATE_LIMIT_WINDOW_MS', DEFAULTS.RATE_LIMIT_WINDOW_MS),

  // Frontend URL (for CORS)
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),

  // Logging
  logLevel: optionalEnv('LOG_LEVEL', 'info'),

  // Plex integration
  plex: {
    enabled: optionalEnvBoolean('PLEX_ENABLED', false),
    host: optionalEnv('PLEX_HOST', 'http://localhost:32400'),
    token: optionalEnv('PLEX_TOKEN', ''),
  },

  // Jellyfin integration
  jellyfin: {
    enabled: optionalEnvBoolean('JELLYFIN_ENABLED', false),
    host: optionalEnv('JELLYFIN_HOST', 'http://localhost:8096'),
    apiKey: optionalEnv('JELLYFIN_API_KEY', ''),
    userId: optionalEnv('JELLYFIN_USER_ID', ''),
  },

  // TMDB discovery integration
  tmdb: {
    apiKey: optionalEnv('TMDB_API_KEY', ''),
  },

  // OpenAI prompt understanding for recommendations
  openai: {
    apiKey: optionalEnv('OPENAI_API_KEY', ''),
    model: optionalEnv('OPENAI_MODEL', 'gpt-4.1-mini'),
  },

  // ntfy push notifications
  ntfy: {
    enabled: optionalEnvBoolean('NTFY_ENABLED', false),
    serverUrl: optionalEnv('NTFY_SERVER_URL', 'https://ntfy.sh'),
    topic: optionalEnv('NTFY_TOPIC', ''),
    accessToken: optionalEnv('NTFY_ACCESS_TOKEN', ''),
  },

  // Email for Kindle ebooks
  email: {
    enabled: optionalEnvBoolean('EMAIL_ENABLED', false),
    smtpHost: optionalEnv('SMTP_HOST', 'smtp.gmail.com'),
    smtpPort: optionalEnvNumber('SMTP_PORT', 587),
    smtpSecure: optionalEnvBoolean('SMTP_SECURE', false),
    smtpUser: optionalEnv('SMTP_USER', ''),
    smtpPassword: optionalEnv('SMTP_PASSWORD', ''),
    fromEmail: optionalEnv('EMAIL_FROM', ''),
    kindleEmail: optionalEnv('KINDLE_EMAIL', 'mm19924@kindle.com'),
  },
} as const;

export type Config = typeof config;
