import { config } from '../config.js';
import { logger } from '../logger.js';
import { qbittorrentService } from './qbittorrent.service.js';
import { wsService } from './websocket.service.js';
import { mediaServerService } from './media-server.service.js';
import { ntfyService } from './ntfy.service.js';
import { checkAndCleanupStorage } from './storage.service.js';
import { createPlexCompatibleAudioCopy } from './media-compatibility.service.js';
import {
  getActiveDownloads,
  updateDownloadProgress,
  updateDownloadStatus,
  setDownloadSavePath,
  getDownloadUserId,
  updateDownloadName,
} from './download.service.js';
import { getUserById } from './user.service.js';
import { addLibraryFile } from './library.service.js';
import { join, extname, dirname, basename } from 'path';
import { existsSync, renameSync } from 'fs';

let pollingInterval: NodeJS.Timeout | null = null;
const missingTorrentLastLoggedAt = new Map<string, number>();
const MISSING_TORRENT_LOG_INTERVAL_MS = 60 * 60 * 1000;

function mapQbState(state: string): 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | null {
  switch (state) {
    case 'downloading':
    case 'stalledDL':
    case 'metaDL':
    case 'forcedDL':
    case 'allocating':
    case 'checkingDL':
      return 'DOWNLOADING';
    case 'pausedDL':
    case 'queuedDL':
      return 'PAUSED';
    case 'uploading':
    case 'stalledUP':
    case 'forcedUP':
    case 'pausedUP':
    case 'queuedUP':
    case 'checkingUP':
      return 'COMPLETED';
    case 'error':
    case 'missingFiles':
      return 'FAILED';
    default:
      return null;
  }
}

function parseMovieFilename(filename: string): { name: string; year: string } | null {
  const match = filename.match(/^(?<name>.+?)[\.\s\(\[\_]+(?<year>19\d{2}|20\d{2})([\.\s\)\].]|$)/);
  if (!match || !match.groups) return null;
  const { name, year } = match.groups;
  if (!name || !year) return null;
  const cleanName = name.replace(/[\._]/g, ' ').trim();
  return { name: cleanName, year };
}

async function pollQBittorrent(): Promise<void> {
  if (!qbittorrentService.isEnabled || !qbittorrentService.isConnected) {
    return;
  }

  try {
    const torrents = await qbittorrentService.getTorrents();
    const activeDownloads = getActiveDownloads();

    for (const download of activeDownloads) {
      // Skip downloads that don't have a qBittorrent hash yet
      if (!download.id) continue;

      // Find matching torrent by checking all torrents
      const dbDownload = getActiveDownloads().find(d => d.id === download.id);
      if (!dbDownload) continue;

      // Get the qBittorrent hash from the database
      const stmt = await import('../db/index.js').then(m => m.db.prepare(
        'SELECT qbittorrent_hash FROM downloads WHERE id = ?'
      ));
      const row = stmt.get(download.id) as { qbittorrent_hash: string | null } | undefined;
      const qbHash = row?.qbittorrent_hash;

      if (!qbHash) continue;

      const torrent = torrents.find(t => t.hash.toLowerCase() === qbHash.toLowerCase());

      if (!torrent) {
        const now = Date.now();
        const lastLoggedAt = missingTorrentLastLoggedAt.get(download.id) ?? 0;

        if (now - lastLoggedAt >= MISSING_TORRENT_LOG_INTERVAL_MS) {
          missingTorrentLastLoggedAt.set(download.id, now);
          logger.warn({ downloadId: download.id, qbHash }, 'Torrent not found in qBittorrent');
        }
        continue;
      }

      missingTorrentLastLoggedAt.delete(download.id);

      // Update name from qBittorrent if it looks like a placeholder (starts with pb- or similar)
      if (download.name.match(/^pb-\d+-\d+$/) && torrent.name) {
        updateDownloadName(download.id, torrent.name);
        download.name = torrent.name; // Update local reference for notifications
      }

      // Update progress
      const progress = Math.round(torrent.progress * 100);
      const eta = torrent.eta > 0 && torrent.eta < 8640000 ? torrent.eta : null;

      updateDownloadProgress(
        download.id,
        progress,
        torrent.downloaded,
        eta,
        torrent.size
      );

      // Send WebSocket update
      wsService.sendDownloadProgress({
        downloadId: download.id,
        progress,
        downloadedBytes: torrent.downloaded,
        eta,
        downloadSpeed: torrent.dlspeed,
        uploadSpeed: torrent.upspeed,
      });

      // Check for status changes
      const newStatus = mapQbState(torrent.state);
      if (newStatus && newStatus !== download.status) {
        updateDownloadStatus(download.id, newStatus);
        wsService.sendDownloadStatusChange({
          downloadId: download.id,
          status: newStatus,
        });

        // Handle completion
        if (newStatus === 'COMPLETED') {
          setDownloadSavePath(download.id, torrent.save_path);
          wsService.sendDownloadCompleted(download.id);

          // Get files info before deleting
          const files = await qbittorrentService.getTorrentFiles(qbHash);

          // Remove torrent from qBittorrent (keep files) to release locks
          try {
            const success = await qbittorrentService.deleteTorrent(qbHash, false);
            if (success) {
              logger.info({ hash: qbHash, name: download.name }, 'Removed completed torrent from qBittorrent');
            } else {
              logger.warn({ hash: qbHash, name: download.name }, 'Failed to remove completed torrent from qBittorrent');
            }
          } catch (error) {
            logger.error({ error, hash: qbHash }, 'Error removing torrent from qBittorrent');
          }

          // Add files to library
          for (const file of files) {
            let filePath = join(torrent.save_path, file.name);

            if (existsSync(filePath)) {
              // Try to rename if we can parse movie info
              const filename = basename(filePath);
              const parsed = parseMovieFilename(filename);

              if (parsed) {
                const ext = extname(filename);
                const newName = `${parsed.name} (${parsed.year})${ext}`;
                const newPath = join(dirname(filePath), newName);

                // Only rename if the name is actually different
                if (filePath !== newPath) {
                  try {
                    renameSync(filePath, newPath);
                    logger.info({ from: filePath, to: newPath }, 'Renamed downloaded file');
                    filePath = newPath;
                  } catch (error) {
                    logger.error({ error, filePath, newPath }, 'Failed to rename file');
                  }
                }
              }

              try {
                const libraryPath = config.plexCompatibleAudioEnabled
                  ? (await createPlexCompatibleAudioCopy(filePath)).filePath
                  : filePath;

                addLibraryFile(libraryPath, download.id);
              } catch (error) {
                logger.error({ filePath, error }, 'Failed to add file to library');
              }
            }
          }

          // Trigger media server library scans
          mediaServerService.scanAllLibraries().catch((error) => {
            logger.error({ error }, 'Failed to trigger media server library scan');
          });

          // Send push notification with username
          const userId = getDownloadUserId(download.id);
          const user = userId ? getUserById(userId) : undefined;
          ntfyService.notifyDownloadComplete(download.name, torrent.size, user?.username).catch((error) => {
            logger.error({ error }, 'Failed to send download complete notification');
          });

          // Check and cleanup storage if needed
          checkAndCleanupStorage().catch((error) => {
            logger.error({ error }, 'Storage cleanup failed after download completion');
          });
        }

        // Handle failure
        if (newStatus === 'FAILED') {
          const errorMessage = 'Download failed in qBittorrent';
          wsService.sendDownloadFailed(download.id, errorMessage);

          // Send push notification for failure with username
          const userId = getDownloadUserId(download.id);
          const user = userId ? getUserById(userId) : undefined;
          ntfyService.notifyDownloadFailed(download.name, errorMessage, user?.username).catch((error) => {
            logger.error({ error }, 'Failed to send download failed notification');
          });
        }
      }
    }
  } catch (error) {
    logger.error('Polling error:', error);
  }
}

export function startPolling(): void {
  if (pollingInterval) {
    return;
  }

  logger.info({ intervalMs: config.pollIntervalMs }, 'Starting qBittorrent polling');
  pollingInterval = setInterval(pollQBittorrent, config.pollIntervalMs);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Stopped qBittorrent polling');
  }
}
