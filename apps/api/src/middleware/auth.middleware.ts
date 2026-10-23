import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSession } from '../services/session.service.js';
import { getUserById } from '../services/user.service.js';
import type { User } from '@movie-server/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    sessionId?: string;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies['session'];

  if (!sessionId) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    reply.clearCookie('session', { path: '/' });
    return reply.status(401).send({
      success: false,
      error: 'Session expired',
    });
  }

  const user = getUserById(session.user_id);
  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'User not found',
    });
  }

  request.user = user;
  request.sessionId = sessionId;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  if (reply.sent) {
    return;
  }

  if (request.user?.username !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required',
    });
  }
}
