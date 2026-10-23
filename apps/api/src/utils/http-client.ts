import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { URL } from 'node:url';

interface FetchWithDnsOptions {
  method?: string;
  headers?: http.OutgoingHttpHeaders;
  body?: string;
  timeoutMs?: number;
}

export class DnsHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;

  constructor(
    status: number,
    statusText: string,
    private responseBody: string
  ) {
    this.status = status;
    this.statusText = statusText;
    this.ok = status >= 200 && status < 300;
  }

  async text(): Promise<string> {
    return this.responseBody;
  }

  async json<T>(): Promise<T> {
    return JSON.parse(this.responseBody) as T;
  }
}

dns.setServers(['1.1.1.1', '8.8.8.8']);

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 20 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });

function lookupWithExplicitDns(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
): void {
  const ipFamily = net.isIP(hostname);

  if (ipFamily) {
    if (options.all) {
      callback(null, [{ address: hostname, family: ipFamily }]);
      return;
    }

    callback(null, hostname, ipFamily);
    return;
  }

  if (hostname === 'localhost') {
    if (options.all) {
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
      return;
    }

    callback(null, '127.0.0.1', 4);
    return;
  }

  dns.promises.resolve4(hostname)
    .then((addresses) => {
      const address = addresses[0];
      if (!address) {
        const error = new Error(`No DNS A record for ${hostname}`) as NodeJS.ErrnoException;
        error.code = 'ENOTFOUND';
        callback(error, '');
        return;
      }

      if (options.all) {
        callback(null, addresses.map((resolvedAddress) => ({ address: resolvedAddress, family: 4 })));
        return;
      }

      callback(null, address, 4);
    })
    .catch((error: NodeJS.ErrnoException) => {
      if (options.family === 6) {
        callback(error, '');
        return;
      }

      callback(error, '');
    });
}

export async function fetchWithDns(
  input: string | URL,
  options: FetchWithDnsOptions = {}
): Promise<DnsHttpResponse> {
  const url = typeof input === 'string' ? new URL(input) : input;
  const transport = url.protocol === 'http:' ? http : https;

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        lookup: lookupWithExplicitDns,
        agent: url.protocol === 'http:' ? httpAgent : httpsAgent,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve(new DnsHttpResponse(
            response.statusCode ?? 0,
            response.statusMessage ?? '',
            Buffer.concat(chunks).toString('utf8')
          ));
        });
      }
    );

    const timeoutMs = options.timeoutMs ?? 15000;
    const timeout = setTimeout(() => {
      request.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${url.hostname}`));
    }, timeoutMs);
    timeout.unref();
    request.on('close', () => clearTimeout(timeout));
    request.on('error', reject);

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}
