import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { logger } from './logger.js';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { registerRoutes } from './routes/index.js';
import { wsService } from './services/websocket.service.js';
import { qbittorrentService } from './services/qbittorrent.service.js';
import { startPolling, stopPolling } from './services/polling.service.js';
import { scanDownloadDirectory } from './services/library.service.js';
import { existsSync, mkdirSync } from 'fs';
import {
  startWantedDownloadScheduler,
  stopWantedDownloadScheduler,
} from './services/wanted-download-scheduler.service.js';

async function main() {
  // Initialize database
  initializeDatabase();

  // Keep the API online even when an external download drive is temporarily unmounted.
  try {
    if (!existsSync(config.downloadDir)) {
      mkdirSync(config.downloadDir, { recursive: true });
    }
  } catch (error) {
    logger.warn({ error, downloadDir: config.downloadDir }, 'Download directory is not available');
  }

  // Create Fastify instance
  const fastify = Fastify({
    logger: false, // We use our own pino logger
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await fastify.register(cookie, {
    secret: config.sessionSecret,
  });

  await fastify.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: config.maxUploadSizeBytes,
    },
  });

  await fastify.register(websocket);

  // WebSocket route
  fastify.get('/ws', { websocket: true }, (socket, _req) => {
    wsService.addClient(socket.socket);
  });

  // Register API routes
  await registerRoutes(fastify);

  // Error handler
  fastify.setErrorHandler((error, _request, reply) => {
    logger.error({ error }, 'Request error');
    
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'Too many requests. Please slow down.',
      });
    }

    return reply.status(error.statusCode || 500).send({
      success: false,
      error: config.nodeEnv === 'production' ? 'Internal server error' : error.message,
    });
  });

  // Connect to qBittorrent
  if (config.qbittorrentEnabled) {
    const connected = await qbittorrentService.login();
    if (connected) {
      startPolling();
    } else {
      logger.warn('qBittorrent not available. Running in disabled torrent mode.');
    }
  } else {
    logger.info('qBittorrent is disabled by configuration');
  }

  // Scan download directory for existing files
  scanDownloadDirectory();
  startWantedDownloadScheduler();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    stopPolling();
    stopWantedDownloadScheduler();
    await fastify.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    logger.info(`Server running at http://${config.host}:${config.port}`);
    logger.info(`WebSocket available at ws://${config.host}:${config.port}/ws`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
