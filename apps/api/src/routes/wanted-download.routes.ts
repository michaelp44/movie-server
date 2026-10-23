import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createWantedDownloadSchema,
  wantedDownloadAvailabilitySchema,
  wantedDownloadIdParamSchema,
} from '@movie-server/shared';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../services/audit.service.js';
import {
  cancelWantedDownload,
  checkWantedDownloadForUser,
  createWantedDownload,
  getWantedDownloadAvailability,
  getWantedDownloads,
} from '../services/wanted-download.service.js';

export async function wantedDownloadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/wanted-downloads',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const items = getWantedDownloads(request.user!.id);
      return reply.send({ success: true, data: { items } });
    }
  );

  fastify.post(
    '/api/wanted-downloads',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createWantedDownloadSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        return reply.status(400).send({
          success: false,
          error: firstIssue?.message ?? 'Invalid auto download',
          details: parseResult.error.issues,
        });
      }

      const item = createWantedDownload(request.user!.id, parseResult.data);
      logAudit(request.user!.id, 'WANTED_DOWNLOAD_CREATE', parseResult.data, request.ip);

      return reply.status(201).send({ success: true, data: { item } });
    }
  );

  fastify.post(
    '/api/wanted-downloads/availability',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = wantedDownloadAvailabilitySchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid wanted availability request',
          details: parseResult.error.issues,
        });
      }

      const items = await getWantedDownloadAvailability(request.user!.id, parseResult.data);
      return reply.send({ success: true, data: { items } });
    }
  );

  fastify.post(
    '/api/wanted-downloads/:id/check',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = wantedDownloadIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ success: false, error: 'Invalid wanted download ID' });
      }

      const item = await checkWantedDownloadForUser(params.data.id, request.user!.id);
      if (!item) {
        return reply.status(404).send({ success: false, error: 'Wanted download not found' });
      }

      logAudit(request.user!.id, 'WANTED_DOWNLOAD_CHECK', { id: params.data.id }, request.ip);
      return reply.send({ success: true, data: { item } });
    }
  );

  fastify.post(
    '/api/wanted-downloads/:id/cancel',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = wantedDownloadIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ success: false, error: 'Invalid wanted download ID' });
      }

      const item = cancelWantedDownload(params.data.id, request.user!.id);
      if (!item) {
        return reply.status(404).send({ success: false, error: 'Wanted download not found' });
      }

      logAudit(request.user!.id, 'WANTED_DOWNLOAD_CANCEL', { id: params.data.id }, request.ip);
      return reply.send({ success: true, data: { item } });
    }
  );
}
