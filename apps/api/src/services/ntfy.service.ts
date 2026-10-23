import { config } from '../config.js';
import { logger } from '../logger.js';

const NTFY_HEALTH_TIMEOUT_MS = 300;
const NTFY_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * ntfy.sh push notification service.
 * Sends notifications when downloads complete or fail.
 */

interface NtfyMessage {
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5; // 1=min, 3=default, 5=max
  tags?: string[];
  click?: string;
  actions?: Array<{
    action: 'view' | 'http' | 'broadcast';
    label: string;
    url?: string;
  }>;
}

class NtfyService {
  private serverUrl: string;
  private topic: string;
  private enabled: boolean;
  private accessToken?: string;
  private healthCache?: { connected: boolean; expiresAt: number };

  constructor() {
    this.serverUrl = config.ntfy.serverUrl;
    this.topic = config.ntfy.topic;
    this.enabled = config.ntfy.enabled;
    this.accessToken = config.ntfy.accessToken;
  }

  /**
   * Check if ntfy integration is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.topic;
  }

  /**
   * Get the topic for a specific user (base topic + username)
   */
  getTopicForUser(username?: string): string {
    if (username) {
      return `${this.topic}-${username}`;
    }
    return this.topic;
  }

  /**
   * Build an Android ntfy deep link that opens the app and subscribes to the topic.
   * Format from ntfy docs: ntfy://<host>/<topic>?display=<name>
   */
  getSubscribeUrlForUser(username?: string): string | null {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const server = new URL(this.serverUrl);
      const topic = encodeURIComponent(this.getTopicForUser(username));
      const params = new URLSearchParams({
        display: 'Movie Server',
      });

      if (server.protocol === 'http:') {
        params.set('secure', 'false');
      }

      return `ntfy://${server.host}/${topic}?${params.toString()}`;
    } catch (error) {
      logger.warn({ error, serverUrl: this.serverUrl }, 'Failed to build ntfy subscribe URL');
      return null;
    }
  }

  getWebUrlForUser(username?: string): string | null {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const server = new URL(this.serverUrl);
      server.pathname = `/${encodeURIComponent(this.getTopicForUser(username))}`;
      server.search = '';
      server.hash = '';
      return server.toString();
    } catch (error) {
      logger.warn({ error, serverUrl: this.serverUrl }, 'Failed to build ntfy web URL');
      return null;
    }
  }

  /**
   * Send a push notification
   */
  async send(message: NtfyMessage, username?: string): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug('ntfy integration disabled, skipping notification');
      return;
    }

    const topic = this.getTopicForUser(username);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const body = {
        topic,
        title: message.title,
        message: message.message,
        priority: message.priority ?? 3,
        tags: message.tags ?? [],
        click: message.click,
        actions: message.actions,
      };

      logger.info({ topic, title: message.title }, 'Sending ntfy notification');

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`ntfy API error: ${response.status} ${response.statusText}`);
      }

      logger.info({ topic }, 'ntfy notification sent successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to send ntfy notification');
      // Don't throw - we don't want to fail operations due to notification failures
    }
  }

  /**
   * Send download completed notification
   */
  async notifyDownloadComplete(name: string, sizeBytes: number, username?: string): Promise<void> {
    const sizeFormatted = this.formatBytes(sizeBytes);

    await this.send({
      title: '✅ Download Complete',
      message: `${name} (${sizeFormatted}) has finished downloading`,
      priority: 3,
      tags: ['white_check_mark', 'movie_camera'],
    }, username);
  }

  /**
   * Send download failed notification
   */
  async notifyDownloadFailed(name: string, error: string, username?: string): Promise<void> {
    await this.send({
      title: '❌ Download Failed',
      message: `${name} failed: ${error}`,
      priority: 4,
      tags: ['x', 'warning'],
    }, username);
  }

  /**
   * Send download started notification
   */
  async notifyDownloadStarted(name: string, username?: string): Promise<void> {
    await this.send({
      title: '⬇️ Download Started',
      message: `Started downloading: ${name}`,
      priority: 2,
      tags: ['arrow_down'],
    }, username);
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Check ntfy server connectivity
   */
  async healthCheck(): Promise<{ connected: boolean }> {
    if (!this.isEnabled()) {
      return { connected: false };
    }

    const now = Date.now();
    if (this.healthCache && this.healthCache.expiresAt > now) {
      return { connected: this.healthCache.connected };
    }

    try {
      // ntfy doesn't have a dedicated health endpoint, so we just check if the server responds
      const response = await fetch(`${this.serverUrl}/${this.topic}/json`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(NTFY_HEALTH_TIMEOUT_MS),
      });
      const connected = response.ok || response.status === 405;
      this.healthCache = {
        connected,
        expiresAt: now + NTFY_HEALTH_CACHE_TTL_MS,
      };
      return { connected };
    } catch {
      this.healthCache = {
        connected: false,
        expiresAt: now + NTFY_HEALTH_CACHE_TTL_MS,
      };
      return { connected: false };
    }
  }
}

export const ntfyService = new NtfyService();
