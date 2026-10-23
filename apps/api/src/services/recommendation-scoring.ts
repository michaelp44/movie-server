import type { MediaItem, ViewingHistoryItem } from './media-server.types.js';

export interface TasteProfile {
  watchedKeys: Set<string>;
  watchedFiles: Set<string>;
  genres: Map<string, number>;
  people: Map<string, number>;
  recentWatched: ViewingHistoryItem[];
}

function addWeightedValues(target: Map<string, number>, values: string[], weight: number): void {
  for (const value of values) {
    const key = value.toLowerCase();
    target.set(key, (target.get(key) ?? 0) + weight);
  }
}

export function buildTasteProfile(history: ViewingHistoryItem[]): TasteProfile {
  const genres = new Map<string, number>();
  const people = new Map<string, number>();
  const watchedKeys = new Set<string>();
  const watchedFiles = new Set<string>();

  history.forEach((item, index) => {
    const recencyWeight = Math.max(1, 8 - Math.floor(index / 5));
    watchedKeys.add(item.ratingKey);
    if (item.file) {
      watchedFiles.add(item.file);
    }

    addWeightedValues(genres, item.genres, recencyWeight);
    addWeightedValues(people, [...item.actors, ...item.directors, ...item.writers], recencyWeight);
  });

  return {
    watchedKeys,
    watchedFiles,
    genres,
    people,
    recentWatched: history.slice(0, 10),
  };
}

function mapScore(values: string[], weights: Map<string, number>, multiplier: number): number {
  return values.reduce((score, value) => {
    return score + ((weights.get(value.toLowerCase()) ?? 0) * multiplier);
  }, 0);
}

export function scoreMediaItem(item: MediaItem, profile: TasteProfile): number {
  let score = 0;

  // Main personalization signal: overlap with genres and people from watched history.
  score += mapScore(item.genres, profile.genres, 3);
  score += mapScore([...item.actors, ...item.directors, ...item.writers], profile.people, 1.5);

  if (item.rating) {
    score += item.rating;
  }

  if (item.viewCount > 0) {
    score += Math.min(10, item.viewCount * 2);
  }

  if (item.year) {
    const age = new Date().getFullYear() - item.year;
    score += Math.max(0, 8 - Math.floor(age / 3));
  }

  if (profile.watchedKeys.has(item.ratingKey) || (item.file && profile.watchedFiles.has(item.file))) {
    score -= 100;
  }

  return score;
}

export const scorePlexMediaItem = scoreMediaItem;
