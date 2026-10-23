import { config } from '../config.js';
import { logger } from '../logger.js';
import { checkAllWantedDownloads } from './wanted-download.service.js';

let wantedDownloadInterval: NodeJS.Timeout | null = null;
let checkInProgress = false;

async function runWantedDownloadCheck(): Promise<void> {
  if (checkInProgress) {
    return;
  }

  checkInProgress = true;
  try {
    await checkAllWantedDownloads();
  } catch (error) {
    logger.error({ error }, 'Wanted download scheduler failed');
  } finally {
    checkInProgress = false;
  }
}

export function startWantedDownloadScheduler(): void {
  if (wantedDownloadInterval) {
    return;
  }

  logger.info({ intervalMs: config.autoDownloadCheckIntervalMs }, 'Starting wanted download scheduler');
  wantedDownloadInterval = setInterval(runWantedDownloadCheck, config.autoDownloadCheckIntervalMs);

  setTimeout(() => {
    runWantedDownloadCheck().catch((error) => {
      logger.error({ error }, 'Initial wanted download check failed');
    });
  }, 30000);
}

export function stopWantedDownloadScheduler(): void {
  if (!wantedDownloadInterval) {
    return;
  }

  clearInterval(wantedDownloadInterval);
  wantedDownloadInterval = null;
  logger.info('Stopped wanted download scheduler');
}
