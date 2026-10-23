import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import type { AdminDownload, Download, DownloadStatus, PaginatedResponse } from '@movie-server/shared';

interface DownloadRow {
  id: string;
  user_id: string;
  name: string;
  status: DownloadStatus;
  progress: number;
  eta: number | null;
  size_bytes: number | null;
  downloaded_bytes: number;
  save_path: string | null;
  created_at: string;
  updated_at: string;
  source_provider: string;
  source_id: string;
  magnet_uri: string | null;
  qbittorrent_hash: string | null;
  error_message: string | null;
}

interface AdminDownloadRow extends DownloadRow {
  username: string;
}

function rowToDownload(row: DownloadRow): Download {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    progress: row.progress,
    eta: row.eta,
    sizeBytes: row.size_bytes,
    downloadedBytes: row.downloaded_bytes,
    savePath: row.save_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceProvider: row.source_provider,
    sourceId: row.source_id,
    errorMessage: row.error_message ?? undefined,
  };
}

function rowToAdminDownload(row: AdminDownloadRow): AdminDownload {
  return {
    ...rowToDownload(row),
    userId: row.user_id,
    username: row.username,
  };
}

export function createDownload(
  userId: string,
  name: string,
  sourceProvider: string,
  sourceId: string,
  magnetUri?: string
): Download {
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO downloads (id, user_id, name, source_provider, source_id, magnet_uri, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, name, sourceProvider, sourceId, magnetUri ?? null, now, now);

  return {
    id,
    name,
    status: 'QUEUED',
    progress: 0,
    eta: null,
    sizeBytes: null,
    downloadedBytes: 0,
    savePath: null,
    createdAt: now,
    updatedAt: now,
    sourceProvider,
    sourceId,
  };
}

export function getDownloadById(id: string): Download | undefined {
  const stmt = db.prepare('SELECT * FROM downloads WHERE id = ?');
  const row = stmt.get(id) as DownloadRow | undefined;
  return row ? rowToDownload(row) : undefined;
}

export function getDownloadByIdForUser(id: string, userId: string): Download | undefined {
  const stmt = db.prepare('SELECT * FROM downloads WHERE id = ? AND user_id = ?');
  const row = stmt.get(id, userId) as DownloadRow | undefined;
  return row ? rowToDownload(row) : undefined;
}

export function getDownloadUserId(id: string): string | undefined {
  const stmt = db.prepare('SELECT user_id FROM downloads WHERE id = ?');
  const row = stmt.get(id) as { user_id: string } | undefined;
  return row?.user_id;
}

export function getDownloadByQbHash(hash: string): Download | undefined {
  const stmt = db.prepare('SELECT * FROM downloads WHERE qbittorrent_hash = ?');
  const row = stmt.get(hash) as DownloadRow | undefined;
  return row ? rowToDownload(row) : undefined;
}

export function getDownloadByQbHashWithUserId(hash: string): { download: Download; userId: string } | undefined {
  const stmt = db.prepare('SELECT * FROM downloads WHERE qbittorrent_hash = ?');
  const row = stmt.get(hash) as DownloadRow | undefined;
  if (!row) return undefined;
  return { download: rowToDownload(row), userId: row.user_id };
}

export function getDownloads(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  statusFilter?: DownloadStatus[]
): PaginatedResponse<Download> {
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['user_id = ?'];
  const params: (string | number)[] = [userId];

  if (statusFilter && statusFilter.length > 0) {
    conditions.push(`status IN (${statusFilter.map(() => '?').join(', ')})`);
    params.push(...statusFilter);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM downloads ${whereClause}`);
  const { count } = countStmt.get(...params) as { count: number };

  const stmt = db.prepare(`
    SELECT * FROM downloads ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...params, pageSize, offset) as DownloadRow[];

  return {
    items: rows.map(rowToDownload),
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

export function updateDownloadStatus(
  id: string,
  status: DownloadStatus,
  errorMessage?: string
): void {
  const stmt = db.prepare(`
    UPDATE downloads 
    SET status = ?, error_message = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(status, errorMessage ?? null, id);
}

export function updateDownloadProgress(
  id: string,
  progress: number,
  downloadedBytes: number,
  eta: number | null,
  sizeBytes?: number | null
): void {
  const stmt = db.prepare(`
    UPDATE downloads 
    SET progress = ?, downloaded_bytes = ?, eta = ?, size_bytes = COALESCE(?, size_bytes), updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(progress, downloadedBytes, eta, sizeBytes ?? null, id);
}

export function setDownloadQbHash(id: string, hash: string): void {
  const stmt = db.prepare(`
    UPDATE downloads SET qbittorrent_hash = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(hash, id);
}

export function setDownloadMagnet(id: string, magnetUri: string): void {
  const stmt = db.prepare(`
    UPDATE downloads SET magnet_uri = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(magnetUri, id);
}

export function setDownloadSavePath(id: string, savePath: string): void {
  const stmt = db.prepare(`
    UPDATE downloads SET save_path = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(savePath, id);
}

export function updateDownloadName(id: string, name: string): void {
  const stmt = db.prepare(`
    UPDATE downloads SET name = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(name, id);
}

export function getActiveDownloads(): Download[] {
  const stmt = db.prepare(`
    SELECT * FROM downloads
    WHERE status IN ('QUEUED', 'FETCHING_MAGNET', 'ADDING_TO_QBITTORRENT', 'DOWNLOADING', 'PAUSED')
    ORDER BY created_at ASC
  `);
  const rows = stmt.all() as DownloadRow[];
  return rows.map(rowToDownload);
}

export function getAllDownloadsForAdmin(): AdminDownload[] {
  const rows = db.prepare(`
    SELECT downloads.*, users.username
    FROM downloads
    INNER JOIN users ON users.id = downloads.user_id
    ORDER BY downloads.created_at DESC
  `).all() as AdminDownloadRow[];

  return rows.map(rowToAdminDownload);
}

export function deleteDownload(id: string): void {
  const stmt = db.prepare('DELETE FROM downloads WHERE id = ?');
  stmt.run(id);
}
