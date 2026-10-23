-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  progress REAL NOT NULL DEFAULT 0,
  eta INTEGER,
  size_bytes INTEGER,
  downloaded_bytes INTEGER NOT NULL DEFAULT 0,
  save_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_provider TEXT NOT NULL,
  source_id TEXT NOT NULL,
  magnet_uri TEXT,
  qbittorrent_hash TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);

-- Wanted downloads table (auto-download when a good quality release appears)
CREATE TABLE IF NOT EXISTS wanted_downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  year INTEGER,
  media_type TEXT NOT NULL DEFAULT 'movie',
  min_quality TEXT NOT NULL DEFAULT '1080p',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source_provider TEXT NOT NULL DEFAULT 'piratebay',
  last_checked_at TEXT,
  last_error TEXT,
  matched_title TEXT,
  matched_quality TEXT,
  download_id TEXT REFERENCES downloads(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wanted_downloads_user_id ON wanted_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_wanted_downloads_status ON wanted_downloads(status);
CREATE INDEX IF NOT EXISTS idx_wanted_downloads_last_checked_at ON wanted_downloads(last_checked_at);

-- Library files table (for tracking completed downloads and uploads)
CREATE TABLE IF NOT EXISTS library_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  download_id TEXT REFERENCES downloads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_library_files_name ON library_files(name);
CREATE INDEX IF NOT EXISTS idx_library_files_download_id ON library_files(download_id);

-- Dismissed recommendations table (per-user "already watched" / never show again)
CREATE TABLE IF NOT EXISTS dismissed_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_recommendations_user_id ON dismissed_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_recommendations_item_id ON dismissed_recommendations(item_id);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('signup_enabled', 'true');
