import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { adminRoutes } from './admin.routes.js';
import { downloadRoutes } from './download.routes.js';
import { downloadActionsRoutes } from './download-actions.routes.js';
import { healthRoutes } from './health.routes.js';
import { recommendationRoutes } from './recommendation.routes.js';
import { wantedDownloadRoutes } from './wanted-download.routes.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(authRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(downloadRoutes);
  await fastify.register(downloadActionsRoutes);
  await fastify.register(recommendationRoutes);
  await fastify.register(wantedDownloadRoutes);
  await fastify.register(healthRoutes);
}
