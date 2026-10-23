// This dependency-free module is also installed into the existing transport process.
import { createServer, type Server } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export interface BridgeConfig {
  token: string;
  ownerPhone: string;
  directory: string;
  port: number;
  activatedAt: number;
}
export interface BridgeMessage {
  id: { _serialized: string };
  from: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  type: string;
}
export interface RecentPersonChat {
  key: string;
  name: string;
  messages: Array<{ fromMe: boolean; timestamp: number; body: string }>;
}
interface BridgeChat {
  id: { _serialized: string };
  name: string;
  isGroup: boolean;
  syncHistory?(): Promise<boolean>;
  fetchMessages(options: { limit: number }): Promise<
    Array<{
      fromMe: boolean;
      timestamp: number;
      body: string;
      type: string;
      hasMedia?: boolean;
      author?: string;
      from?: string;
    }>
  >;
}
export interface BridgeClient {
  getContactLidAndPhone(ids: string[]): Promise<Array<{ lid: string; pn: string }>>;
  sendMessage(to: string, body: string): Promise<{ id: { _serialized: string } }>;
  getChats?(): Promise<BridgeChat[]>;
  getContactById?(id: string): Promise<{
    id: { _serialized: string };
    name?: string;
    pushname?: string;
    shortName?: string;
  }>;
}
export function atomicJson(path: string, value: unknown) {
  writeFileSync(path + '.tmp', JSON.stringify(value), { mode: 0o600, flush: true });
  renameSync(path + '.tmp', path);
}
export class OwnerBridge {
  private aliases = new Set<string>();
  private ready = false;
  private server?: Server;
  constructor(
    private c: BridgeConfig,
    private client: BridgeClient,
  ) {
    if (!/^[a-f0-9]{64}$/.test(c.token) || !/^972\d{8,9}$/.test(c.ownerPhone))
      throw new Error('Invalid bridge configuration');
    if (!Number.isInteger(c.activatedAt) || c.activatedAt < 1)
      throw new Error('Invalid activation time');
    mkdirSync(join(c.directory, 'inbox'), { recursive: true, mode: 0o700 });
    mkdirSync(join(c.directory, 'sent'), { recursive: true, mode: 0o700 });
  }
  async connected() {
    this.ready = false;
    this.aliases.clear();
    const pn = this.c.ownerPhone + '@c.us';
    const mappings = await this.client.getContactLidAndPhone([pn]);
    // Require the provider to bind the LID to the configured phone; never learn identity from message content.
    const mapping = mappings.find((m) => m.pn === pn && /@lid$/.test(m.lid));
    if (!mapping) throw new Error('Owner identity mapping unavailable');
    this.aliases = new Set([pn, mapping.lid]);
    this.ready = true;
  }
  disconnected() {
    this.ready = false;
    this.aliases.clear();
  }
  ingest(message: BridgeMessage) {
    if (
      !this.ready ||
      message.fromMe ||
      !this.aliases.has(message.from) ||
      message.type !== 'chat' ||
      message.timestamp < this.c.activatedAt ||
      !message.body ||
      message.body.length > 4000
    )
      return false;
    const id = createHash('sha256').update(message.id._serialized).digest('hex');
    const path = join(this.c.directory, 'inbox', id + '.json');
    if (!existsSync(path))
      atomicJson(path, { id, text: message.body, timestamp: message.timestamp });
    return true;
  }
  async listen() {
    this.server = createServer(async (req, res) => {
      const reply = (status: number, value: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(value));
      };
      const supplied = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      const expected = Buffer.from(this.c.token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        return reply(401, { error: 'unauthorized' });
      try {
        if (req.method === 'GET' && req.url === '/health')
          return reply(200, { ready: this.ready, ownerOnly: true });
        if (req.method === 'GET' && req.url?.startsWith('/people/recent')) {
          if (!this.ready) return reply(503, { error: 'not ready' });
          if (!this.client.getChats) return reply(501, { error: 'history unavailable' });
          if (req.url.split('?')[0] !== '/people/recent') return reply(404, { error: 'not found' });
          const url = new URL(req.url, 'http://127.0.0.1');
          const offset = Number(url.searchParams.get('offset') ?? '0');
          if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
            return reply(400, { error: 'invalid offset' });
          const chats = await this.client.getChats();
          const eligible = chats.filter((chat) => {
            const id = chat.id?._serialized ?? '';
            return (
              ((!chat.isGroup && /@(c\.us|lid)$/.test(id)) ||
                (chat.isGroup && /@g\.us$/.test(id))) &&
              !/(?:status|broadcast|newsletter)/i.test(id)
            );
          });
          const page = eligible.slice(offset, offset + 20);
          const items: RecentPersonChat[] = [];
          for (const chat of page) {
            try {
              await chat.syncHistory?.();
            } catch {
              // Continue with locally available chat history if provider sync is unavailable.
            }
            const messages = await chat.fetchMessages({ limit: 200 });
            const recent = messages
              .filter(
                (message) =>
                  message.type === 'chat' &&
                  !message.hasMedia &&
                  typeof message.body === 'string' &&
                  message.body.trim(),
              )
              .sort((a, b) => a.timestamp - b.timestamp)
              .slice(-200)
              .map((message) => ({
                fromMe: !!message.fromMe,
                timestamp: message.timestamp,
                body: message.body.slice(0, 1200),
              }));
            if (chat.isGroup) {
              const authorCounts = new Map<string, number>();
              for (const message of messages) {
                const id = message.author || message.from || '';
                if (
                  !message.fromMe &&
                  message.type === 'chat' &&
                  !message.hasMedia &&
                  id &&
                  !id.includes('@g.us')
                )
                  authorCounts.set(id, (authorCounts.get(id) ?? 0) + 1);
              }
              const authorIds = [...authorCounts]
                .filter(([, count]) => count >= 2)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([id]) => id);
              const mappings = await this.client.getContactLidAndPhone(authorIds).catch(() => []);
              for (const authorId of authorIds) {
                const canonicalId =
                  mappings.find((mapping) => mapping.lid === authorId || mapping.pn === authorId)
                    ?.pn ?? authorId;
                const contact = await this.client.getContactById?.(authorId).catch(() => undefined);
                const name =
                  contact?.name?.trim() ||
                  contact?.pushname?.trim() ||
                  contact?.shortName?.trim() ||
                  authorId.split('@')[0];
                const authored = messages
                  .filter(
                    (message) =>
                      !message.fromMe &&
                      (message.author === authorId || message.from === authorId) &&
                      message.type === 'chat' &&
                      !message.hasMedia &&
                      message.body.trim(),
                  )
                  .slice(-200)
                  .map((message) => ({
                    fromMe: false,
                    timestamp: message.timestamp,
                    body: message.body.slice(0, 1200),
                  }));
                if (authored.length)
                  items.push({
                    key: createHash('sha256').update(canonicalId).digest('hex'),
                    name: String(name || 'איש קשר').slice(0, 100),
                    messages: authored,
                  });
              }
            } else if (recent.some((message) => !message.fromMe))
              items.push({
                key: createHash('sha256').update(chat.id._serialized).digest('hex'),
                name: String(chat.name || 'איש קשר ללא שם').slice(0, 100),
                messages: recent,
              });
          }
          return reply(200, {
            items,
            totalChats: eligible.length,
            nextOffset: offset + page.length < eligible.length ? offset + page.length : null,
          });
        }
        if (req.method === 'GET' && req.url === '/inbox') {
          const items = readdirSync(join(this.c.directory, 'inbox'))
            .filter((n) => n.endsWith('.json'))
            .map((n) => JSON.parse(readFileSync(join(this.c.directory, 'inbox', n), 'utf8')))
            .filter((m) => !m.acknowledged)
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 50);
          return reply(200, { items });
        }
        if (req.method !== 'POST' || !['/send', '/ack'].includes(req.url ?? ''))
          return reply(404, { error: 'not found' });
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 16000) return reply(413, { error: 'too large' });
        }
        let p;
        try {
          p = JSON.parse(body);
        } catch {
          return reply(400, { error: 'invalid JSON' });
        }
        if (req.url === '/ack') {
          if (typeof p.id !== 'string' || !/^[a-f0-9]{64}$/.test(p.id))
            return reply(400, { error: 'invalid id' });
          const path = join(this.c.directory, 'inbox', p.id + '.json');
          if (existsSync(path)) {
            const item = JSON.parse(readFileSync(path, 'utf8'));
            atomicJson(path, { ...item, text: '', acknowledged: true });
          }
          return reply(200, { ok: true });
        }
        if (!this.ready) return reply(503, { error: 'not ready' });
        if (
          typeof p.operationId !== 'string' ||
          !/^[a-f0-9-]{36}$/.test(p.operationId) ||
          typeof p.text !== 'string' ||
          !p.text.trim() ||
          p.text.length > 4000 ||
          Object.keys(p).some((k) => !['operationId', 'text'].includes(k))
        )
          return reply(400, { error: 'invalid send' });
        const path = join(this.c.directory, 'sent', p.operationId + '.json');
        const hash = createHash('sha256').update(p.text).digest('hex');
        if (existsSync(path)) {
          const previous = JSON.parse(readFileSync(path, 'utf8'));
          if (previous.hash !== hash) return reply(409, { error: 'operation content changed' });
          return reply(200, previous);
        }
        // Persist uncertainty before crossing the provider boundary. A crash cannot cause blind resend.
        atomicJson(path, { state: 'uncertain', hash });
        try {
          const sent = await this.client.sendMessage(this.c.ownerPhone + '@c.us', p.text);
          if (!sent.id._serialized) throw new Error('No receipt');
          const receipt = { state: 'sent', hash, messageId: sent.id._serialized };
          atomicJson(path, receipt);
          return reply(200, receipt);
        } catch {
          return reply(200, { state: 'uncertain', hash });
        }
      } catch {
        return reply(500, { error: 'bridge operation failed' });
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.c.port, '127.0.0.1', resolve);
    });
    return this.server.address();
  }
  async close() {
    if (this.server)
      await new Promise<void>((resolve, reject) =>
        this.server!.close((e) => (e ? reject(e) : resolve())),
      );
  }
}

export async function startOwnerBridge(
  client: BridgeClient & { on(event: string, listener: (message: BridgeMessage) => void): unknown },
  configPath: string,
) {
  if (!existsSync(configPath)) return;
  try {
    const bridge = new OwnerBridge(JSON.parse(readFileSync(configPath, 'utf8')), client);
    await bridge.listen();
    client.on('ready', () => {
      void bridge
        .connected()
        .catch(() => console.error('Life assistant owner identity unavailable.'));
    });
    client.on('disconnected', () => bridge.disconnected());
    client.on('auth_failure', () => bridge.disconnected());
    client.on('message_create', (message) => {
      try {
        bridge.ingest(message);
      } catch {
        console.error('Life assistant inbox persistence failed.');
      }
    });
    console.log('Life assistant owner-only bridge listening.');
  } catch {
    console.error('Life assistant bridge disabled: setup failed. Wedding transport continues.');
  }
}
