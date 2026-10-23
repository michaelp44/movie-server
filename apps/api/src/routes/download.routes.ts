import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { downloadRequestSchema, downloadConfirmSchema, downloadIdParamSchema, paginationSchema } from '@movie-server/shared';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../services/audit.service.js';
import { getProvider } from '../providers/index.js';
import {
  getDownloads,
  getDownloadByIdForUser,
} from '../services/download.service.js';
import { startDownloadFromProviderResult } from '../services/download-start.service.js';
import { logger } from '../logger.js';

export async function downloadRoutes(fastify: FastifyInstance): Promise<void> {
  // Get all downloads for current user
  fastify.get('/api/downloads', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.safeParse(request.query);
    const { page, pageSize } = query.success ? query.data : { page: 1, pageSize: 20 };

    const downloads = getDownloads(request.user!.id, page, pageSize);

    return reply.send({ success: true, data: downloads });
  });

  // Search provider for content
  fastify.post('/api/downloads/request', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = downloadRequestSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request',
        details: parseResult.error.issues,
      });
    }

    const { query, provider: providerName } = parseResult.data;
    const provider = getProvider(providerName);

    if (!provider) {
      return reply.status(400).send({
        success: false,
        error: `Unknown provider: ${providerName}`,
      });
    }

    logAudit(request.user!.id, 'DOWNLOAD_REQUEST', { query, provider: providerName }, request.ip);

    try {
      const results = await provider.search(query);
      return reply.send({ success: true, data: { results } });
    } catch (error) {
      logger.error({ error, provider: providerName, query }, 'Provider search failed');
      return reply.status(500).send({
        success: false,
        error: 'Search failed',
      });
    }
  });

  // Confirm download
  fastify.post('/api/downloads/confirm', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = downloadConfirmSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request',
      });
    }

    const { provider: providerName, resultId } = parseResult.data;
    const provider = getProvider(providerName);

    if (!provider) {
      return reply.status(400).send({
        success: false,
        error: `Unknown provider: ${providerName}`,
      });
    }

    try {
      const download = await startDownloadFromProviderResult(
        request.user!.id,
        providerName,
        resultId
      );
      logAudit(request.user!.id, 'DOWNLOAD_CONFIRM', {
        downloadId: download.id,
        provider: providerName,
        resultId
      }, request.ip);

      return reply.send({ success: true, data: { download } });
    } catch (error) {
      logger.error({ error, provider: providerName, resultId }, 'Download confirm failed');
      return reply.status(500).send({
        success: false,
        error: 'Failed to start download',
      });
    }
  });

  // Get single download (only if owned by current user)
  fastify.get('/api/downloads/:id', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = downloadIdParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ success: false, error: 'Invalid download ID' });
    }

    const download = getDownloadByIdForUser(params.data.id, request.user!.id);
    if (!download) {
      return reply.status(404).send({ success: false, error: 'Download not found' });
    }

    return reply.send({ success: true, data: { download } });
  });
}
