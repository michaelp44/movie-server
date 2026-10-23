import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { changePasswordSchema, loginSchema, signupSchema } from '@movie-server/shared';
import {
  changeUserPassword,
  verifyPassword,
  getUserById,
  getUserByUsername,
  createUser,
} from '../services/user.service.js';
import { createSession, deleteSession, getSession } from '../services/session.service.js';
import { logAudit } from '../services/audit.service.js';
import { config } from '../config.js';
import { DEFAULTS } from '@movie-server/shared';
import { ntfyService } from '../services/ntfy.service.js';
import { isSignupEnabled } from '../services/settings.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/auth/signup-status', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: { signupEnabled: isSignupEnabled() },
    });
  });

  // Signup
  fastify.post('/api/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSignupEnabled()) {
      return reply.status(403).send({
        success: false,
        error: 'Signup is currently disabled',
      });
    }

    const parseResult = signupSchema.safeParse(request.body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return reply.status(400).send({
        success: false,
        error: firstError?.message || 'Invalid signup data',
      });
    }

    const { username, password } = parseResult.data;

    // Check if username already exists
    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: 'Username already taken',
      });
    }

    // Create the user
    const user = await createUser(username, password);

    // Create session and log in automatically
    const sessionId = createSession(user.id);

    logAudit(user.id, 'SIGNUP', { username }, request.ip);

    reply.setCookie('session', sessionId, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: DEFAULTS.SESSION_MAX_AGE_SECONDS,
    });

    return reply.status(201).send({
      success: true,
      data: { user },
    });
  });

  // Login
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid credentials format',
      });
    }

    const { username, password } = parseResult.data;
    const user = await verifyPassword(username, password);

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
      });
    }

    const sessionId = createSession(user.id);
    
    logAudit(user.id, 'LOGIN', { username }, request.ip);

    reply.setCookie('session', sessionId, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: DEFAULTS.SESSION_MAX_AGE_SECONDS,
    });

    return reply.send({
      success: true,
      data: { user },
    });
  });

  // Logout
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies['session'];
    
    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        logAudit(session.user_id, 'LOGOUT', {}, request.ip);
        deleteSession(sessionId);
      }
    }

    reply.clearCookie('session', { path: '/' });
    
    return reply.send({ success: true });
  });

  fastify.post(
    '/api/auth/change-password',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = changePasswordSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.status(400).send({
          success: false,
          error: firstError?.message ?? 'Invalid password change request',
        });
      }

      const changed = await changeUserPassword(
        request.user!.id,
        parseResult.data.currentPassword,
        parseResult.data.newPassword
      );

      if (!changed) {
        return reply.status(400).send({
          success: false,
          error: 'Current password is incorrect',
        });
      }

      logAudit(request.user!.id, 'PASSWORD_CHANGE', {}, request.ip);
      return reply.send({ success: true });
    }
  );

  // Get current user
  fastify.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies['session'];
    
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: 'Not authenticated',
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

    // Get ntfy topic and subscribe deep link for user if enabled
    const ntfyTopic = ntfyService.isEnabled() ? ntfyService.getTopicForUser(user.username) : null;
    const ntfySubscribeUrl = ntfyService.getSubscribeUrlForUser(user.username);
    const ntfyWebUrl = ntfyService.getWebUrlForUser(user.username);

    return reply.send({
      success: true,
      data: { user, ntfyTopic, ntfySubscribeUrl, ntfyWebUrl },
    });
  });
}
