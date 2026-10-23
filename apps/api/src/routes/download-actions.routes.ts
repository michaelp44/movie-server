import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { downloadIdParamSchema } from '@movie-server/shared';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../services/audit.service.js';
import { getDownloadByIdForUser, updateDownloadStatus, deleteDownload } from '../services/download.service.js';
import { deleteLibraryFilesByDownloadId, getLibraryFilesByDownloadId } from '../services/library.service.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import { wsService } from '../services/websocket.service.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { tmdbService } from '../services/tmdb.service.js';

async function getQbHash(downloadId: string): Promise<string | null> {
  const stmt = db.prepare('SELECT qbittorrent_hash FROM downloads WHERE id = ?');
  const row = stmt.get(downloadId) as { qbittorrent_hash: string | null } | undefined;
  return row?.qbittorrent_hash ?? null;
}

export async function downloadActionsRoutes(fastify: FastifyInstance): Promise<void> {
  // Pause download
  fastify.post('/api/downloads/:id/pause', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    if (download.status !== 'DOWNLOADING') {
      return reply.status(400).send({ success: false, error: 'Download is not active' });
    }

    const qbHash = await getQbHash(download.id);
    if (qbHash && qbittorrentService.isEnabled) {
      const success = await qbittorrentService.pauseTorrent(qbHash);
      if (!success) {
        return reply.status(500).send({ success: false, error: 'Failed to pause in qBittorrent' });
      }
    }

    updateDownloadStatus(download.id, 'PAUSED');
    wsService.sendDownloadStatusChange({ downloadId: download.id, status: 'PAUSED' });
    logAudit(request.user!.id, 'DOWNLOAD_PAUSE', { downloadId: download.id }, request.ip);

    return reply.send({ success: true, data: { download: getDownloadByIdForUser(download.id, request.user!.id) } });
  });

  // Resume download
  fastify.post('/api/downloads/:id/resume', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    if (download.status !== 'PAUSED') {
      return reply.status(400).send({ success: false, error: 'Download is not paused' });
    }

    const qbHash = await getQbHash(download.id);
    if (qbHash && qbittorrentService.isEnabled) {
      const success = await qbittorrentService.resumeTorrent(qbHash);
      if (!success) {
        return reply.status(500).send({ success: false, error: 'Failed to resume in qBittorrent' });
      }
    }

    updateDownloadStatus(download.id, 'DOWNLOADING');
    wsService.sendDownloadStatusChange({ downloadId: download.id, status: 'DOWNLOADING' });
    logAudit(request.user!.id, 'DOWNLOAD_RESUME', { downloadId: download.id }, request.ip);

    return reply.send({ success: true, data: { download: getDownloadByIdForUser(download.id, request.user!.id) } });
  });

  // Cancel download
  fastify.post('/api/downloads/:id/cancel', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    if (download.status === 'COMPLETED' || download.status === 'CANCELED') {
      return reply.status(400).send({ success: false, error: 'Cannot cancel this download' });
    }

    const qbHash = await getQbHash(download.id);
    if (qbHash && qbittorrentService.isEnabled) {
      await qbittorrentService.deleteTorrent(qbHash, true);
    }

    updateDownloadStatus(download.id, 'CANCELED');
    wsService.sendDownloadStatusChange({ downloadId: download.id, status: 'CANCELED' });
    logAudit(request.user!.id, 'DOWNLOAD_CANCEL', { downloadId: download.id }, request.ip);

    return reply.send({ success: true, data: { download: getDownloadByIdForUser(download.id, request.user!.id) } });
  });

  // Get download files
  fastify.get('/api/downloads/:id/files', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    const qbHash = await getQbHash(download.id);
    if (!qbHash) {
      return reply.send({ success: true, data: { files: [] } });
    }

    try {
      const files = await qbittorrentService.getTorrentFiles(qbHash);
      return reply.send({ success: true, data: { files } });
    } catch (error) {
      logger.error({ error, downloadId: download.id }, 'Failed to get torrent files');
      return reply.status(500).send({ success: false, error: 'Failed to get files' });
    }
  });

  // Open best matching TMDB info page for a downloaded item
  fastify.get('/api/downloads/:id/info', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    const infoUrl = await tmdbService.resolveInfoUrl(download.name);
    return reply.redirect(infoUrl);
  });

  // Delete download and associated files
  fastify.delete('/api/downloads/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      logger.warn({ params: request.params, error: params.error }, 'Invalid download ID for delete');
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      logger.warn({ downloadId: params.data.id, userId: request.user!.id }, 'Download not found for delete');
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    // Delete torrent from qBittorrent if still there
    const qbHash = await getQbHash(download.id);
    if (qbHash && qbittorrentService.isEnabled) {
      try {
        const deletedFromQbittorrent = await qbittorrentService.deleteTorrent(qbHash, true);
        if (!deletedFromQbittorrent) {
          logger.warn({ downloadId: download.id, qbHash }, 'qBittorrent did not confirm torrent deletion');
          return reply.status(502).send({
            success: false,
            error: 'Failed to delete torrent from qBittorrent',
          });
        }
      } catch (error) {
        logger.warn({ error, downloadId: download.id, qbHash }, 'Failed to delete torrent from qBittorrent');
        return reply.status(502).send({
          success: false,
          error: 'Failed to delete torrent from qBittorrent',
        });
      }
    }

    // Delete associated library files (and files from disk)
    const libraryFiles = getLibraryFilesByDownloadId(download.id);
    const deletedFilesCount = deleteLibraryFilesByDownloadId(download.id);
    logger.info({ downloadId: download.id, deletedFilesCount }, 'Deleted library files for download');

    if (deletedFilesCount !== libraryFiles.length) {
      logger.warn({
        downloadId: download.id,
        expectedFilesCount: libraryFiles.length,
        deletedFilesCount,
      }, 'Some library files failed to delete');
      return reply.status(500).send({
        success: false,
        error: 'Some downloaded files could not be deleted from disk',
      });
    }

    // Delete the download record
    deleteDownload(download.id);

    logAudit(request.user!.id, 'DOWNLOAD_DELETE', { downloadId: download.id, deletedFilesCount }, request.ip);

    return reply.send({ success: true });
  });
}
