import { describe, expect, it } from 'vitest';
import { scoreForSamsungOptical, sortByCompatibility } from './compatibility.js';
import type { ProviderSearchResult } from '@movie-server/shared';

describe('scoreForSamsungOptical', () => {
  it('prefers 1080p H.264 AC3 releases', () => {
    const result = scoreForSamsungOptical('Movie 2024 1080p BluRay x264 AC3 5.1', 3 * 1024 * 1024 * 1024);

    expect(result.level).toBe('best');
    expect(result.score).toBeGreaterThanOrEqual(72);
  });

  it('marks 4K HEVC AAC 5.1 releases as risky', () => {
    const result = scoreForSamsungOptical('Movie 2024 2160p 4K BluRay x265 HEVC 10bit AAC 5.1', 8 * 1024 * 1024 * 1024);

    expect(result.level).toBe('risky');
  });

  it('sorts by compatibility before seed count', () => {
    const risky: ProviderSearchResult = {
      id: 'risky',
      title: 'Movie 2024 2160p x265 EAC3 Atmos',
      sizeBytes: 16 * 1024 * 1024 * 1024,
      seeds: 500,
      peers: 10,
      provider: 'test',
      compatibility: scoreForSamsungOptical('Movie 2024 2160p x265 EAC3 Atmos', 16 * 1024 * 1024 * 1024),
    };
    const compatible: ProviderSearchResult = {
      id: 'compatible',
      title: 'Movie 2024 1080p x264 AC3 5.1',
      sizeBytes: 3 * 1024 * 1024 * 1024,
      seeds: 5,
      peers: 1,
      provider: 'test',
      compatibility: scoreForSamsungOptical('Movie 2024 1080p x264 AC3 5.1', 3 * 1024 * 1024 * 1024),
    };

    expect(sortByCompatibility([risky, compatible])[0]?.id).toBe('compatible');
  });
});
