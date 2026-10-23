import { describe, expect, it } from 'vitest';
import { extractMagnetInfoHash } from './qbittorrent.service.js';

describe('extractMagnetInfoHash', () => {
  it('extracts a hash from a normal magnet URI', () => {
    expect(
      extractMagnetInfoHash(
        'magnet:?xt=urn:btih:9DCEDB4DA9667EFA5AE2020F5EB70D57BFA5C5D9&dn=Title'
      )
    ).toBe('9dcedb4da9667efa5ae2020f5eb70d57bfa5c5d9');
  });

  it('extracts a hash from a URL-encoded magnet URI', () => {
    expect(
      extractMagnetInfoHash(
        'magnet:?xt=urn%3Abtih%3A9DCEDB4DA9667EFA5AE2020F5EB70D57BFA5C5D9&dn=Title'
      )
    ).toBe('9dcedb4da9667efa5ae2020f5eb70d57bfa5c5d9');
  });

  it('returns null when the magnet has no info hash', () => {
    expect(extractMagnetInfoHash('magnet:?dn=Title')).toBeNull();
  });
});
