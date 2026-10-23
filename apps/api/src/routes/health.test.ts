import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(healthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('database');
      expect(body.services).toHaveProperty('qbittorrent');
      expect(body.services).toHaveProperty('websocket');
    });
  });

  describe('GET /api/providers', () => {
    it('should return list of providers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/providers',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('providers');
      expect(Array.isArray(body.data.providers)).toBe(true);
      
      // Should have at least the torrent provider used by the search UI
      const torrentProvider = body.data.providers.find((p: { name: string }) => p.name === 'piratebay');
      expect(torrentProvider).toBeDefined();
      expect(torrentProvider.displayName).toBe('Torrent Search');
    });
  });
});
