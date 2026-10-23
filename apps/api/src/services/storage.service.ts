import { execSync } from 'child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { mediaServerService } from './media-server.service.js';
import {
  getAllLibraryFilesOldestFirst,
  deleteLibraryFile,
  getAbsoluteFilePath,
} from './library.service.js';

// Minimum free space threshold in bytes (20GB)
const MIN_FREE_SPACE_BYTES = 20 * 1024 * 1024 * 1024;

/**
 * Get available disk space in bytes for the download directory
 */
function getAvailableDiskSpace(): number {
  try {
    // Use df command to get available space (works on macOS and Linux)
    const output = execSync(`df -k "${config.downloadDir}" | tail -1 | awk '{print $4}'`, {
      encoding: 'utf-8',
    });
    const availableKB = parseInt(output.trim(), 10);
    return availableKB * 1024; // Convert KB to bytes
  } catch (error) {
    logger.error({ error }, 'Failed to get available disk space');
    return Infinity; // Return Infinity to prevent accidental deletions on error
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Smart storage cleanup
 * Deletes files to free up space when disk is running low
 * Priority: watched files (oldest first), then unwatched files (oldest first)
 */
export async function cleanupStorage(): Promise<{ deleted: string[]; freedBytes: number }> {
  const availableSpace = getAvailableDiskSpace();
  const deleted: string[] = [];
  let freedBytes = 0;

  logger.info(
    { availableSpace: formatBytes(availableSpace), threshold: formatBytes(MIN_FREE_SPACE_BYTES) },
    'Checking storage space'
  );

  if (availableSpace >= MIN_FREE_SPACE_BYTES) {
    logger.info('Sufficient disk space available, no cleanup needed');
    return { deleted, freedBytes };
  }

  logger.warn(
    { availableSpace: formatBytes(availableSpace) },
    'Low disk space detected, starting cleanup'
  );

  // Get all library files (oldest first)
  const allFiles = getAllLibraryFilesOldestFirst();
  
  if (allFiles.length === 0) {
    logger.warn('No library files to clean up');
    return { deleted, freedBytes };
  }

  // Get watched files from configured media servers.
  const watchedFiles = await mediaServerService.getWatchedFiles();
  const watchedPaths = new Set(watchedFiles.map((f) => f.file));

  // Separate files into watched and unwatched
  const watchedLibraryFiles = allFiles.filter((f) => {
    const absolutePath = getAbsoluteFilePath(f);
    return watchedPaths.has(absolutePath);
  });

  const unwatchedLibraryFiles = allFiles.filter((f) => {
    const absolutePath = getAbsoluteFilePath(f);
    return !watchedPaths.has(absolutePath);
  });

  logger.info(
    { watched: watchedLibraryFiles.length, unwatched: unwatchedLibraryFiles.length },
    'Categorized library files'
  );

  // Delete watched files first (oldest first), then unwatched if needed
  const filesToDelete = [...watchedLibraryFiles, ...unwatchedLibraryFiles];

  for (const file of filesToDelete) {
    // Check if we have enough space now
    const currentSpace = getAvailableDiskSpace();
    if (currentSpace >= MIN_FREE_SPACE_BYTES) {
      logger.info(
        { freedBytes: formatBytes(freedBytes), deletedCount: deleted.length },
        'Sufficient space freed, stopping cleanup'
      );
      break;
    }

    // Delete the file
    const fileSize = file.sizeBytes;
    const success = deleteLibraryFile(file.id);

    if (success) {
      deleted.push(file.name);
      freedBytes += fileSize;
      logger.info(
        { name: file.name, size: formatBytes(fileSize), totalFreed: formatBytes(freedBytes) },
        'Deleted file to free space'
      );
    }
  }

  if (deleted.length > 0) {
    logger.info(
      { deletedCount: deleted.length, freedBytes: formatBytes(freedBytes) },
      'Storage cleanup completed'
    );
  } else {
    logger.warn('No files were deleted during cleanup');
  }

  return { deleted, freedBytes };
}

/**
 * Check if storage cleanup is needed and perform it
 * Called after download completion
 */
export async function checkAndCleanupStorage(): Promise<void> {
  try {
    await cleanupStorage();
  } catch (error) {
    logger.error({ error }, 'Storage cleanup failed');
  }
}
