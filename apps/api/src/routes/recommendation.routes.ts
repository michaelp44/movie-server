import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { dismissRecommendationSchema, promptRecommendationSchema } from '@movie-server/shared';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getPromptRecommendationsForUser,
  getRecommendationsForUser,
} from '../services/recommendation.service.js';
import { mediaServerService } from '../services/media-server.service.js';
import type { MediaServerSource } from '../services/media-server.types.js';
import { dismissRecommendation } from '../services/dismissed-recommendation.service.js';

interface PosterQuery {
  path?: string;
  source?: MediaServerSource;
}

export async function recommendationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/recommendations',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sections = await getRecommendationsForUser(request.user!.id);

      return reply.send({
        success: true,
        data: { sections },
      });
    }
  );

  fastify.get(
    '/api/recommendations/poster',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path, source } = request.query as PosterQuery;

      if (!path || !path.startsWith('/')) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid poster path',
        });
      }

      const image = await mediaServerService.getImage(source ?? 'plex', path);
      if (!image) {
        return reply.status(404).send({
          success: false,
          error: 'Poster not found',
        });
      }

      return reply
        .type(image.contentType)
        .send(image.bytes);
    }
  );

  fastify.post(
    '/api/recommendations/dismiss',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = dismissRecommendationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid recommendation dismissal',
          details: parseResult.error.issues,
        });
      }

      dismissRecommendation(request.user!.id, parseResult.data);

      return reply.send({
        success: true,
        data: {},
      });
    }
  );

  fastify.post(
    '/api/recommendations/prompt',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = promptRecommendationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid recommendation prompt',
          details: parseResult.error.issues,
        });
      }

      const sections = await getPromptRecommendationsForUser(
        request.user!.id,
        parseResult.data.prompt
      );

      return reply.send({
        success: true,
        data: { sections },
      });
    }
  );
}
