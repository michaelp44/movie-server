import type { ProviderSearchResult } from '@movie-server/shared';
import { piratebay } from 'piratebay-scraper';
import type { SourceProvider } from './types.js';
import { logger } from '../logger.js';
import { fetchWithDns } from '../utils/http-client.js';
import { scoreForSamsungOptical, sortByCompatibility } from './compatibility.js';
import { parseMagnetUri } from './validation.js';

interface ApiBaySearchHit {
  id?: string | number;
  info_hash?: string;
  leechers?: string | number;
  name?: string;
  seeders?: string | number;
  size?: string | number;
}

interface ScraperSearchHit {
  title?: string;
  seeders?: number;
  leechers?: number;
  size?: string;
  link?: string;
}

// Store search results temporarily to retrieve magnet links and details
const resultCache = new Map<string, { magnet: string; title: string }>();

const API_BAY_SEARCH_URL = 'https://apibay.org/q.php';
const MAX_RESULTS = 30;
const SEARCH_TIMEOUT_MS = 7000;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; results: ProviderSearchResult[] }>();

function numeric(value: string | number | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidInfoHash(hash: string | undefined): hash is string {
  return Boolean(hash && /^[a-f\d]{40}$/i.test(hash) && !/^0{40}$/.test(hash));
}

function parseScraperSize(size: string | undefined): number | null {
  if (!size) return null;

  const normalized = size.replace(/\u00a0/g, ' ').trim();
  const match = normalized.match(/^([\d.]+)\s*([kmgt]?i?b|[kmgt]?b|bytes?)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    byte: 1,
    bytes: 1,
    b: 1,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  };

  const multiplier = multipliers[unit];
  return multiplier ? Math.round(amount * multiplier) : null;
}

function magnetFor(hash: string, title: string): string {
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
  ];
  const params = new URLSearchParams({ xt: `urn:btih:${hash}`, dn: title });
  for (const tracker of trackers) params.append('tr', tracker);
  return `magnet:?${params.toString()}`;
}

export function mapApiBayResults(items: ApiBaySearchHit[]): ProviderSearchResult[] {
  const results = items
    .filter((item) => Boolean(
      item.name &&
      item.name !== 'No results returned' &&
      isValidInfoHash(item.info_hash)
    ))
    .sort((a, b) => (numeric(b.seeders) ?? 0) - (numeric(a.seeders) ?? 0))
    .slice(0, MAX_RESULTS)
    .map((item) => {
      const title = item.name!;
      const hash = item.info_hash!.toUpperCase();
      const resultId = `apibay-${item.id ?? hash}`;
      resultCache.set(resultId, { magnet: magnetFor(hash, title), title });
      return {
        id: resultId,
        title,
        sizeBytes: numeric(item.size),
        seeds: numeric(item.seeders),
        peers: numeric(item.leechers),
        provider: 'piratebay',
        compatibility: scoreForSamsungOptical(title, numeric(item.size)),
      } satisfies ProviderSearchResult;
    });
  return sortByCompatibility(results);
}

export function mapScraperResults(items: ScraperSearchHit[]): ProviderSearchResult[] {
  const results = items.reduce<ProviderSearchResult[]>(
    (mappedResults, item) => {
      if (!item.title || !item.link?.startsWith('magnet:?')) {
        return mappedResults;
      }

      const title = item.title;
      const magnet = item.link;
      const infoHash = parseMagnetUri(magnet).infoHash?.toUpperCase();
      if (!isValidInfoHash(infoHash)) {
        return mappedResults;
      }

      const sizeBytes = parseScraperSize(item.size);
      const resultId = `scraper-${infoHash}`;
      resultCache.set(resultId, { magnet, title });

      mappedResults.push({
        id: resultId,
        title,
        sizeBytes,
        seeds: numeric(item.seeders),
        peers: numeric(item.leechers),
        provider: 'piratebay',
        compatibility: scoreForSamsungOptical(title, sizeBytes),
      });

      return mappedResults;
    },
    []
  );

  return sortByCompatibility(results).slice(0, MAX_RESULTS);
}

/**
 * Torrent provider backed by The Pirate Bay's small JSON API.
 *
 * The provider name stays "piratebay" so existing frontend requests and
 * download records keep working, but the brittle mirror scraper is no longer
 * used.
 */
export class PirateBayProvider implements SourceProvider {
  readonly name = 'piratebay';
  readonly displayName = 'Torrent Search';

  async search(query: string): Promise<ProviderSearchResult[]> {
    logger.info({ provider: this.name, query }, 'Searching torrent index');

    const searchQuery = query.trim();
    if (!searchQuery) {
      return [];
    }

    const cacheKey = searchQuery.toLocaleLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return [...cached.results];

    try {
      const url = new URL(API_BAY_SEARCH_URL);
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('cat', '0');
      const response = await fetchWithDns(url, { timeoutMs: SEARCH_TIMEOUT_MS });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Torrent search API failed: ${response.status} ${body.slice(0, 200)}`);
      }

      const sortedResults = mapApiBayResults(await response.json<ApiBaySearchHit[]>());
      searchCache.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        results: sortedResults,
      });

      logger.info({ provider: this.name, resultCount: sortedResults.length }, 'Search completed');
      return sortedResults;
    } catch (error) {
      logger.warn({ error, query }, 'Torrent search API failed, trying scraper fallback');

      const fallbackResults = mapScraperResults(await piratebay.search(searchQuery));
      searchCache.set(cacheKey, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        results: fallbackResults,
      });

      logger.info({
        provider: this.name,
        resultCount: fallbackResults.length,
        fallback: 'scraper',
      }, 'Search completed');
      return fallbackResults;
    }
  }

  async getMagnet(resultId: string): Promise<string> {
    logger.info({ provider: this.name, resultId }, 'Getting magnet for result');

    const cached = resultCache.get(resultId);
    if (!cached) {
      throw new Error(`Magnet not found for result: ${resultId}`);
    }

    // Don't delete cache entry yet - getDetails may be called after
    return cached.magnet;
  }

  async getDetails(resultId: string): Promise<Record<string, unknown>> {
    const cached = resultCache.get(resultId);
    if (!cached) {
      return { title: resultId };
    }

    // Clean up cache entry after getting details
    resultCache.delete(resultId);

    return { title: cached.title };
  }
}
