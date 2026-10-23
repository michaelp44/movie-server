import { describe, expect, it, vi } from 'vitest';

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { mapApiBayResults, mapScraperResults } from './piratebay-provider.js';

describe('mapApiBayResults', () => {
  it('maps API Bay results, filters invalid rows, and keeps a usable magnet', async () => {
    const results = mapApiBayResults([
      {
        id: '1',
        name: 'Dune 2021 1080p BluRay x264 AC3',
        info_hash: 'ED0DA850C273E3E15A819BDCBBF418BC85107EC8',
        seeders: '25',
        leechers: '4',
        size: '2947989023',
      },
      {
        id: '0',
        name: 'No results returned',
        info_hash: '0000000000000000000000000000000000000000',
        seeders: '0',
        leechers: '0',
        size: '0',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'apibay-1',
      title: 'Dune 2021 1080p BluRay x264 AC3',
      seeds: 25,
      peers: 4,
      sizeBytes: 2947989023,
      provider: 'piratebay',
    });

    const provider = new (await import('./piratebay-provider.js')).PirateBayProvider();
    await expect(provider.getMagnet('apibay-1')).resolves.toContain(
      'xt=urn%3Abtih%3AED0DA850C273E3E15A819BDCBBF418BC85107EC8'
    );
  });

  it('maps scraper fallback results into downloadable provider results', () => {
    const results = mapScraperResults([
      {
        title: 'The Matrix (1999) 1080p BrRip x264 - YIFY',
        seeders: 856,
        leechers: 100,
        size: '1.86 GiB',
        link: 'magnet:?xt=urn:btih:D7A46713EAEE18C746B3254B7D1492A50FD9D6CE&dn=The+Matrix',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'scraper-D7A46713EAEE18C746B3254B7D1492A50FD9D6CE',
      title: 'The Matrix (1999) 1080p BrRip x264 - YIFY',
      seeds: 856,
      peers: 100,
      provider: 'piratebay',
    });
    expect(results[0]?.sizeBytes).toBe(1997159793);
  });
});
