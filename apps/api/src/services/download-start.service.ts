import type { Download } from '@movie-server/shared';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getProvider } from '../providers/index.js';
import {
  createDownload,
  getDownloadById,
  setDownloadMagnet,
  setDownloadQbHash,
  updateDownloadStatus,
} from './download.service.js';
import { qbittorrentService } from './qbittorrent.service.js';

export async function startDownloadFromProviderResult(
  userId: string,
  providerName: string,
  resultId: string
): Promise<Download> {
  const provider = getProvider(providerName);

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const magnetOrTorrent = await provider.getMagnet(resultId);
  const isTorrentUrl = magnetOrTorrent.startsWith('torrent:');
  const downloadUrl = isTorrentUrl ? magnetOrTorrent.slice(8) : magnetOrTorrent;

  let name = resultId;
  if (provider.getDetails) {
    const details = await provider.getDetails(resultId);
    name = (details['title'] as string) || resultId;
  }

  const download = createDownload(userId, name, providerName, resultId, downloadUrl);
  setDownloadMagnet(download.id, downloadUrl);
  updateDownloadStatus(download.id, 'FETCHING_MAGNET');

  if (qbittorrentService.isEnabled) {
    updateDownloadStatus(download.id, 'ADDING_TO_QBITTORRENT');

    const hash = await qbittorrentService.addMagnet(downloadUrl, config.downloadDir);
    if (hash) {
      setDownloadQbHash(download.id, hash);
      updateDownloadStatus(download.id, 'DOWNLOADING');
    } else {
      updateDownloadStatus(download.id, 'FAILED', 'Failed to add to qBittorrent');
      logger.warn({ downloadId: download.id, providerName, resultId }, 'Failed to add auto download to qBittorrent');
    }
  } else {
    updateDownloadStatus(download.id, 'QUEUED');
  }

  const updatedDownload = getDownloadById(download.id);
  if (!updatedDownload) {
    throw new Error(`Download not found after creation: ${download.id}`);
  }

  return updatedDownload;
}
