import { describe, expect, it } from 'vitest';
import {
  buildTasteProfile,
  scoreMediaItem,
  type TasteProfile,
} from './recommendation-scoring.js';
import type { MediaItem, ViewingHistoryItem } from './media-server.types.js';

function media(overrides: Partial<MediaItem>): MediaItem {
  return {
    ratingKey: 'candidate',
    source: 'plex',
    type: 'movie',
    title: 'Candidate',
    viewCount: 0,
    genres: [],
    directors: [],
    writers: [],
    actors: [],
    ...overrides,
  };
}

describe('recommendation scoring', () => {
  it('scores genre and cast overlap higher than unrelated items', () => {
    const history: ViewingHistoryItem[] = [
      {
        ...media({
          ratingKey: 'watched-1',
          title: 'Watched Movie',
          genres: ['Sci-Fi', 'Drama'],
          actors: ['Example Actor'],
          directors: ['Example Director'],
          file: '/movies/watched.mkv',
        }),
        viewedAt: 1710000000,
      },
    ];
    const profile = buildTasteProfile(history);

    const similar = scoreMediaItem(
      media({
        ratingKey: 'similar',
        genres: ['Sci-Fi'],
        actors: ['Example Actor'],
        rating: 8,
      }),
      profile
    );
    const unrelated = scoreMediaItem(
      media({
        ratingKey: 'unrelated',
        genres: ['Comedy'],
        actors: ['Different Actor'],
        rating: 8,
      }),
      profile
    );

    expect(similar).toBeGreaterThan(unrelated);
  });

  it('penalizes items already watched by rating key or file path', () => {
    const profile: TasteProfile = {
      watchedKeys: new Set(['watched-1']),
      watchedFiles: new Set(['/movies/watched.mkv']),
      genres: new Map([['drama', 5]]),
      people: new Map(),
      recentWatched: [],
    };

    const alreadyWatchedByKey = scoreMediaItem(
      media({ ratingKey: 'watched-1', genres: ['Drama'] }),
      profile
    );
    const alreadyWatchedByFile = scoreMediaItem(
      media({ ratingKey: 'other', file: '/movies/watched.mkv', genres: ['Drama'] }),
      profile
    );
    const unwatched = scoreMediaItem(
      media({ ratingKey: 'unwatched', file: '/movies/new.mkv', genres: ['Drama'] }),
      profile
    );

    expect(alreadyWatchedByKey).toBeLessThan(unwatched);
    expect(alreadyWatchedByFile).toBeLessThan(unwatched);
  });
});
