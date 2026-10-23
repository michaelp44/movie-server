import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { downloadIdParamSchema } from '@movie-server/shared';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { logAudit } from '../services/audit.service.js';
import { deleteUserById, getUserById, listUsers } from '../services/user.service.js';
import { isSignupEnabled, setSignupEnabled } from '../services/settings.service.js';
import {
  deleteDownload,
  getAllDownloadsForAdmin,
  getDownloadById,
} from '../services/download.service.js';
import { db } from '../db/index.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import {
  deleteLibraryFilesByDownloadId,
  getLibraryFilesByDownloadId,
} from '../services/library.service.js';
import { logger } from '../logger.js';

const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

const signupSettingsSchema = z.object({
  enabled: z.boolean(),
});

function getQbHash(downloadId: string): string | null {
  const stmt = db.prepare('SELECT qbittorrent_hash FROM downloads WHERE id = ?');
  const row = stmt.get(downloadId) as { qbittorrent_hash: string | null } | undefined;
  return row?.qbittorrent_hash ?? null;
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/admin/overview',
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          users: listUsers(),
          downloads: getAllDownloadsForAdmin(),
          settings: {
            signupEnabled: isSignupEnabled(),
          },
        },
      });
    }
  );

  fastify.delete(
    '/api/admin/users/:id',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = userIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ success: false, error: 'Invalid user ID' });
      }

      const user = getUserById(params.data.id);
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      if (user.username === 'admin') {
        return reply.status(400).send({ success: false, error: 'Cannot delete the admin user' });
      }

      const deletedUser = deleteUserById(user.id);
      logAudit(request.user!.id, 'ADMIN_USER_DELETE', {
        deletedUserId: user.id,
        deletedUsername: user.username,
      }, request.ip);

      return reply.send({ success: true, data: { user: deletedUser } });
    }
  );

  fastify.put(
    '/api/admin/settings/signup',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = signupSettingsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: 'Invalid signup setting' });
      }

      const signupEnabled = setSignupEnabled(parseResult.data.enabled);
      logAudit(request.user!.id, 'ADMIN_SIGNUP_SETTING_UPDATE', { signupEnabled }, request.ip);

      return reply.send({
        success: true,
        data: {
          settings: {
            signupEnabled,
          },
        },
      });
    }
  );

  fastify.delete(
    '/api/admin/downloads/:id',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = downloadIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ success: false, error: 'Invalid download ID' });
      }

      const download = getDownloadById(params.data.id);
      if (!download) {
        return reply.status(404).send({ success: false, error: 'Download not found' });
      }

      const qbHash = getQbHash(download.id);
      if (qbHash && qbittorrentService.isEnabled) {
        try {
          const deletedFromQbittorrent = await qbittorrentService.deleteTorrent(qbHash, true);
          if (!deletedFromQbittorrent) {
            logger.warn({ downloadId: download.id, qbHash }, 'qBittorrent did not confirm admin torrent deletion');
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

      const libraryFiles = getLibraryFilesByDownloadId(download.id);
      const deletedFilesCount = deleteLibraryFilesByDownloadId(download.id);

      if (deletedFilesCount !== libraryFiles.length) {
        logger.warn({
          downloadId: download.id,
          expectedFilesCount: libraryFiles.length,
          deletedFilesCount,
        }, 'Some library files failed to delete during admin download deletion');
        return reply.status(500).send({
          success: false,
          error: 'Some downloaded files could not be deleted from disk',
        });
      }

      deleteDownload(download.id);

      logAudit(request.user!.id, 'ADMIN_DOWNLOAD_DELETE', {
        downloadId: download.id,
        name: download.name,
        deletedFilesCount,
      }, request.ip);

      return reply.send({ success: true });
    }
  );
}
