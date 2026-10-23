import { v4 as uuidv4 } from 'uuid';
import type {
  CreateWantedDownloadInput,
  ProviderSearchResult,
  WantedDownloadAvailability,
  WantedDownloadAvailabilityInput,
  WantedDownload,
  WantedDownloadQuality,
  WantedDownloadStatus,
} from '@movie-server/shared';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { getProvider } from '../providers/index.js';
import { startDownloadFromProviderResult } from './download-start.service.js';

interface WantedDownloadRow {
  id: string;
  user_id: string;
  title: string;
  year: number | null;
  media_type: 'movie' | 'show';
  min_quality: WantedDownloadQuality;
  status: WantedDownloadStatus;
  source_provider: string;
  last_checked_at: string | null;
  last_error: string | null;
  matched_title: string | null;
  matched_quality: string | null;
  download_id: string | null;
  created_at: string;
  updated_at: string;
}

interface QualityMatch {
  result: ProviderSearchResult;
  quality: string;
  score: number;
}

const BAD_QUALITY_PATTERN = /\b(cam|hdcam|camrip|ts|hdts|telesync|tc|telecine|dvdscr|screener|scr)\b/i;
const GOOD_SOURCE_PATTERN = /\b(web[-.\s]?dl|webrip|web|bluray|blu[-.\s]?ray|brrip|bdrip)\b/i;
const MIN_SEEDS = 5;

function rowToWantedDownload(row: WantedDownloadRow): WantedDownload {
  return {
    id: row.id,
    title: row.title,
    year: row.year ?? undefined,
    mediaType: row.media_type,
    minQuality: row.min_quality,
    status: row.status,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastError: row.last_error ?? undefined,
    matchedTitle: row.matched_title ?? undefined,
    matchedQuality: row.matched_quality ?? undefined,
    downloadId: row.download_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRequiredResolutionRank(minQuality: WantedDownloadQuality): number {
  switch (minQuality) {
    case '2160p':
      return 4;
    case '1080p':
      return 3;
    case '720p':
      return 2;
  }
}

function getResolutionRank(title: string): { rank: number; label: string } {
  if (/\b(2160p|4k|uhd)\b/i.test(title)) {
    return { rank: 4, label: '2160p' };
  }

  if (/\b1080p\b/i.test(title)) {
    return { rank: 3, label: '1080p' };
  }

  if (/\b720p\b/i.test(title)) {
    return { rank: 2, label: '720p' };
  }

  return { rank: 0, label: 'unknown' };
}

function scoreQuality(result: ProviderSearchResult, minQuality: WantedDownloadQuality): QualityMatch | undefined {
  const title = result.title;
  const seeds = result.seeds ?? 0;

  if (BAD_QUALITY_PATTERN.test(title) || seeds < MIN_SEEDS) {
    return undefined;
  }

  const resolution = getResolutionRank(title);
  if (resolution.rank < getRequiredResolutionRank(minQuality)) {
    return undefined;
  }

  if (!GOOD_SOURCE_PATTERN.test(title)) {
    return undefined;
  }

  const sourceScore = /blu[-.\s]?ray|brrip|bdrip/i.test(title) ? 40 : 30;
  const seedScore = Math.min(30, Math.log10(seeds + 1) * 10);
  const sizeGb = result.sizeBytes ? result.sizeBytes / (1024 ** 3) : 0;
  const sizeScore = sizeGb >= 1 && sizeGb <= 30 ? 10 : 0;
  const score = sourceScore + (resolution.rank * 10) + seedScore + sizeScore;

  return {
    result,
    quality: `${resolution.label} ${GOOD_SOURCE_PATTERN.exec(title)?.[0] ?? 'release'}`,
    score,
  };
}

function buildSearchQuery(input: { title: string; year?: number | null }): string {
  return [input.title, input.year ?? undefined]
    .filter(Boolean)
    .join(' ');
}

export function createWantedDownload(
  userId: string,
  input: CreateWantedDownloadInput
): WantedDownload {
  const existing = db.prepare(`
    SELECT * FROM wanted_downloads
    WHERE user_id = ?
      AND lower(title) = lower(?)
      AND COALESCE(year, 0) = COALESCE(?, 0)
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, input.title, input.year ?? null) as WantedDownloadRow | undefined;

  if (existing) {
    return rowToWantedDownload(existing);
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO wanted_downloads (
      id, user_id, title, year, media_type, min_quality, status, source_provider, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'piratebay', ?, ?)
  `).run(
    id,
    userId,
    input.title,
    input.year ?? null,
    input.mediaType,
    input.minQuality,
    now,
    now
  );

  return getWantedDownloadByIdForUser(id, userId)!;
}

function getActiveWantedByTitle(
  userId: string,
  title: string,
  year?: number
): WantedDownloadRow | undefined {
  return db.prepare(`
    SELECT * FROM wanted_downloads
    WHERE user_id = ?
      AND lower(title) = lower(?)
      AND COALESCE(year, 0) = COALESCE(?, 0)
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, title, year ?? null) as WantedDownloadRow | undefined;
}

export function getWantedDownloadByIdForUser(
  id: string,
  userId: string
): WantedDownload | undefined {
  const row = db.prepare(`
    SELECT * FROM wanted_downloads
    WHERE id = ? AND user_id = ?
  `).get(id, userId) as WantedDownloadRow | undefined;

  return row ? rowToWantedDownload(row) : undefined;
}

export function getWantedDownloads(userId: string): WantedDownload[] {
  const rows = db.prepare(`
    SELECT * FROM wanted_downloads
    WHERE user_id = ?
    ORDER BY
      CASE status
        WHEN 'ACTIVE' THEN 0
        WHEN 'FAILED' THEN 1
        WHEN 'DOWNLOADED' THEN 2
        ELSE 3
      END,
      created_at DESC
  `).all(userId) as WantedDownloadRow[];

  return rows.map(rowToWantedDownload);
}

export function cancelWantedDownload(id: string, userId: string): WantedDownload | undefined {
  db.prepare(`
    UPDATE wanted_downloads
    SET status = 'CANCELED', updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'ACTIVE'
  `).run(new Date().toISOString(), id, userId);

  return getWantedDownloadByIdForUser(id, userId);
}

function getActiveWantedRows(): WantedDownloadRow[] {
  return db.prepare(`
    SELECT * FROM wanted_downloads
    WHERE status = 'ACTIVE'
    ORDER BY
      COALESCE(last_checked_at, '1970-01-01T00:00:00.000Z') ASC,
      created_at ASC
  `).all() as WantedDownloadRow[];
}

function markChecked(id: string, error?: string): void {
  db.prepare(`
    UPDATE wanted_downloads
    SET last_checked_at = ?, last_error = ?, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), error ?? null, new Date().toISOString(), id);
}

function markDownloaded(
  wanted: WantedDownloadRow,
  match: QualityMatch,
  downloadId: string
): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE wanted_downloads
    SET
      status = 'DOWNLOADED',
      last_checked_at = ?,
      last_error = NULL,
      matched_title = ?,
      matched_quality = ?,
      download_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(now, match.result.title, match.quality, downloadId, now, wanted.id);
}

async function findBestQualityMatch(
  title: string,
  year: number | undefined,
  minQuality: WantedDownloadQuality,
  providerName = 'piratebay'
): Promise<QualityMatch | undefined> {
  const provider = getProvider(providerName);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const results = await provider.search(buildSearchQuery({ title, year }));
  return results
    .map((result) => scoreQuality(result, minQuality))
    .filter((result): result is QualityMatch => Boolean(result))
    .sort((a, b) => b.score - a.score)[0];
}

export async function getWantedDownloadAvailability(
  userId: string,
  input: WantedDownloadAvailabilityInput
): Promise<WantedDownloadAvailability[]> {
  const availability: WantedDownloadAvailability[] = [];

  for (const item of input.items) {
    const existing = getActiveWantedByTitle(userId, item.title, item.year);
    const match = await findBestQualityMatch(item.title, item.year, input.minQuality);

    availability.push({
      itemId: item.id,
      title: item.title,
      year: item.year,
      hasGoodQuality: Boolean(match),
      alreadyWanted: Boolean(existing),
      canAddWanted: !match && !existing,
      matchedTitle: match?.result.title,
      matchedQuality: match?.quality,
    });
  }

  return availability;
}

export async function checkWantedDownload(wanted: WantedDownloadRow): Promise<void> {
  const provider = getProvider(wanted.source_provider);
  if (!provider) {
    markChecked(wanted.id, `Unknown provider: ${wanted.source_provider}`);
    return;
  }

  try {
    const match = await findBestQualityMatch(
      wanted.title,
      wanted.year ?? undefined,
      wanted.min_quality,
      wanted.source_provider
    );

    if (!match) {
      markChecked(wanted.id);
      logger.info({ wantedId: wanted.id, title: wanted.title }, 'No good quality release found yet');
      return;
    }

    const download = await startDownloadFromProviderResult(
      wanted.user_id,
      wanted.source_provider,
      match.result.id
    );

    if (download.status === 'FAILED') {
      markChecked(wanted.id, download.errorMessage ?? 'Failed to start download');
      return;
    }

    markDownloaded(wanted, match, download.id);
    logger.info({
      wantedId: wanted.id,
      title: wanted.title,
      matchedTitle: match.result.title,
      quality: match.quality,
      downloadId: download.id,
    }, 'Wanted download matched and started');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Wanted check failed';
    markChecked(wanted.id, message);
    logger.error({ error, wantedId: wanted.id, title: wanted.title }, 'Wanted download check failed');
  }
}

export async function checkWantedDownloadForUser(id: string, userId: string): Promise<WantedDownload | undefined> {
  const row = db.prepare(`
    SELECT * FROM wanted_downloads
    WHERE id = ? AND user_id = ?
  `).get(id, userId) as WantedDownloadRow | undefined;

  if (!row || row.status !== 'ACTIVE') {
    return row ? rowToWantedDownload(row) : undefined;
  }

  await checkWantedDownload(row);
  return getWantedDownloadByIdForUser(id, userId);
}

export async function checkAllWantedDownloads(): Promise<void> {
  const rows = getActiveWantedRows();

  for (const row of rows) {
    await checkWantedDownload(row);
  }
}
