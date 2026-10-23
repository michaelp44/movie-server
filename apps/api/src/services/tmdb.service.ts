import { config } from '../config.js';
import { logger } from '../logger.js';
import { fetchWithDns } from '../utils/http-client.js';
import type { ViewingHistoryItem } from './media-server.types.js';

interface TmdbSearchResult {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_count?: number;
}

interface TmdbMediaResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
}

interface TmdbDetailsResult extends TmdbMediaResult {
  runtime?: number | null;
  episode_run_time?: number[];
}

interface TmdbListResponse<T> {
  results?: T[];
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbGenreResponse {
  genres?: TmdbGenre[];
}

export interface TmdbMediaItem {
  id: number;
  mediaType: 'movie' | 'show';
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
  rating?: number;
  runtimeMinutes?: number;
  voteCount: number;
  popularity: number;
  genres: string[];
  reason?: string;
}

export interface TmdbPromptPreferences {
  mediaType?: 'movie' | 'show';
  genres?: string[];
  maxRuntimeMinutes?: number;
  keywords?: string[];
}

class TmdbService {
  private baseUrl = 'https://api.themoviedb.org/3';
  private imageBaseUrl = 'https://image.tmdb.org/t/p/w342';
  private apiKey = config.tmdb.apiKey;
  private genreCache: Map<string, string> | undefined;
  private genreNameCache: Map<string, string> | undefined;

  isEnabled(): boolean {
    return this.apiKey.length > 0;
  }

  private async getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('language', 'en-US');

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetchWithDns(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    return await response.json<T>();
  }

  private getHistorySearchTitle(item: ViewingHistoryItem): string {
    return item.type === 'episode' && item.showTitle ? item.showTitle : item.title;
  }

  private getYear(date?: string): number | undefined {
    return date ? Number(date.slice(0, 4)) || undefined : undefined;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async getGenreMap(): Promise<Map<string, string>> {
    if (this.genreCache) {
      return this.genreCache;
    }

    const [movieGenres, tvGenres] = await Promise.all([
      this.getJson<TmdbGenreResponse>('/genre/movie/list'),
      this.getJson<TmdbGenreResponse>('/genre/tv/list'),
    ]);
    const genreMap = new Map<string, string>();

    for (const genre of [...(movieGenres.genres ?? []), ...(tvGenres.genres ?? [])]) {
      genreMap.set(String(genre.id), genre.name);
    }

    this.genreCache = genreMap;
    return genreMap;
  }

  private async getGenreNameMap(): Promise<Map<string, string>> {
    if (this.genreNameCache) {
      return this.genreNameCache;
    }

    await this.getGenreMap();
    const genreNameMap = new Map<string, string>();

    this.genreCache?.forEach((name, id) => {
      genreNameMap.set(name.toLowerCase(), id);
    });
    genreNameMap.set('sci fi', genreNameMap.get('science fiction') ?? '');
    genreNameMap.set('scifi', genreNameMap.get('science fiction') ?? '');
    genreNameMap.set('science fiction', genreNameMap.get('science fiction') ?? '');
    genreNameMap.set('fantasy', genreNameMap.get('sci-fi & fantasy') ?? genreNameMap.get('fantasy') ?? '');

    this.genreNameCache = new Map(
      [...genreNameMap.entries()].filter((entry): entry is [string, string] => Boolean(entry[1]))
    );
    return this.genreNameCache;
  }

  private async parsePrompt(prompt: string, history: ViewingHistoryItem[], preferences?: TmdbPromptPreferences): Promise<{
    mediaType: 'movie' | 'show';
    genreIds: string[];
    maxRuntime?: number;
  }> {
    const normalizedPrompt = prompt.toLowerCase().replace(/[-_]+/g, ' ');
    const mediaType = preferences?.mediaType
      ?? (/\b(show|tv|series|episode|episodes)\b/.test(normalizedPrompt) ? 'show' : 'movie');
    const genreNameMap = await this.getGenreNameMap();
    const genreIds = new Set<string>();
    const requestedGenres = preferences?.genres ?? [];

    for (const genre of requestedGenres) {
      const id = genreNameMap.get(genre.toLowerCase());
      if (id) {
        genreIds.add(id);
      }
    }

    genreNameMap.forEach((id, name) => {
      if (normalizedPrompt.includes(name)) {
        genreIds.add(id);
      }
    });

    if (genreIds.size === 0) {
      const preferredGenres = new Map<string, number>();
      for (const item of history) {
        for (const genre of item.genres) {
          preferredGenres.set(genre.toLowerCase(), (preferredGenres.get(genre.toLowerCase()) ?? 0) + 1);
        }
      }

      [...preferredGenres.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .forEach(([genre]) => {
          const id = genreNameMap.get(genre);
          if (id) {
            genreIds.add(id);
          }
        });
    }

    const runtimeMatch = /\b(?:under|up to|max|maximum|less than)?\s*(\d{1,3})\s*(?:min|mins|minute|minutes)\b/.exec(normalizedPrompt);
    const maxRuntime = preferences?.maxRuntimeMinutes
      ?? (runtimeMatch?.[1] ? Number(runtimeMatch[1]) : undefined);

    return {
      mediaType,
      genreIds: [...genreIds],
      maxRuntime,
    };
  }

  private async mapResult(
    result: TmdbMediaResult,
    mediaType: 'movie' | 'show',
    reason?: string
  ): Promise<TmdbMediaItem | undefined> {
    const title = mediaType === 'movie' ? result.title : result.name;
    if (!title) {
      return undefined;
    }

    const genreMap = await this.getGenreMap();
    const genres = (result.genre_ids ?? [])
      .map((id) => genreMap.get(String(id)))
      .filter((genre): genre is string => Boolean(genre));

    return {
      id: result.id,
      mediaType,
      title,
      year: this.getYear(mediaType === 'movie' ? result.release_date : result.first_air_date),
      overview: result.overview,
      posterUrl: result.poster_path ? `${this.imageBaseUrl}${result.poster_path}` : undefined,
      rating: result.vote_average,
      voteCount: result.vote_count ?? 0,
      popularity: result.popularity ?? 0,
      genres,
      reason,
    };
  }

  private async getRuntimeMinutes(id: number, mediaType: 'movie' | 'show'): Promise<number | undefined> {
    const pathType = mediaType === 'movie' ? 'movie' : 'tv';

    try {
      const details = await this.getJson<TmdbDetailsResult>(`/${pathType}/${id}`);
      if (mediaType === 'movie') {
        return details.runtime ?? undefined;
      }

      const runtimes = details.episode_run_time ?? [];
      return runtimes.length > 0 ? Math.min(...runtimes) : undefined;
    } catch (error) {
      logger.debug({ error, id, mediaType }, 'Failed to get TMDB runtime details');
      return undefined;
    }
  }

  private async searchWatchedItem(item: ViewingHistoryItem): Promise<{ id: number; mediaType: 'movie' | 'show'; title: string } | undefined> {
    const query = this.getHistorySearchTitle(item);
    if (!query) {
      return undefined;
    }

    const mediaType = item.type === 'movie' ? 'movie' : 'show';
    const searchPath = mediaType === 'movie' ? '/search/movie' : '/search/tv';

    try {
      const response = await this.getJson<TmdbListResponse<TmdbSearchResult>>(searchPath, {
        query,
        include_adult: 'false',
      });
      const result = response.results?.[0];
      const title = mediaType === 'movie' ? result?.title : result?.name;

      if (!result || !title) {
        return undefined;
      }

      return {
        id: result.id,
        mediaType,
        title,
      };
    } catch (error) {
      logger.error({ error, query, mediaType }, 'Failed to search TMDB watched item');
      return undefined;
    }
  }

  private cleanSearchTitle(rawName: string): { title: string; year?: number } {
    const withoutExtension = rawName.replace(/\.[a-z0-9]{2,5}$/i, '');
    const yearMatch = /\b(19\d{2}|20\d{2})\b/.exec(withoutExtension);
    const title = withoutExtension
      .replace(/\b(S\d{1,2}E\d{1,2}|S\d{1,2}|Season\s+\d+)\b.*$/i, '')
      .replace(/\b(19\d{2}|20\d{2})\b.*$/i, '')
      .replace(/[._-]+/g, ' ')
      .replace(/\b(720p|1080p|2160p|4k|uhd|hdr|dv|bluray|blu ray|brrip|bdrip|web-dl|webdl|webrip|x264|x265|h264|h265|hevc|aac|dts|yify|rarbg|proper|repack|extended|unrated)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title: title || rawName,
      year: yearMatch?.[1] ? Number(yearMatch[1]) : undefined,
    };
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getSearchResultYear(result: TmdbSearchResult): number | undefined {
    return this.getYear(result.release_date ?? result.first_air_date);
  }

  private scoreSearchResult(result: TmdbSearchResult, queryTitle: string, queryYear?: number): number {
    const resultTitle = result.title ?? result.name;
    if (!resultTitle || result.media_type === 'person') {
      return -Infinity;
    }

    const normalizedQuery = this.normalizeTitle(queryTitle);
    const normalizedResult = this.normalizeTitle(resultTitle);
    let score = 0;

    if (normalizedResult === normalizedQuery) {
      score += 100;
    } else if (normalizedResult.includes(normalizedQuery) || normalizedQuery.includes(normalizedResult)) {
      score += 50;
    } else {
      const queryWords = new Set(normalizedQuery.split(' ').filter(Boolean));
      const resultWords = new Set(normalizedResult.split(' ').filter(Boolean));
      const overlap = [...queryWords].filter((word) => resultWords.has(word)).length;
      score += (overlap / Math.max(1, queryWords.size)) * 40;
    }

    const resultYear = this.getSearchResultYear(result);
    if (queryYear && resultYear) {
      score += queryYear === resultYear ? 30 : Math.max(-20, 10 - Math.abs(queryYear - resultYear) * 5);
    }

    score += Math.min(15, Math.log10((result.vote_count ?? 0) + 1) * 5);
    score += Math.min(10, (result.popularity ?? 0) / 20);

    return score;
  }

  getSearchUrlForName(rawName: string): string {
    const parsed = this.cleanSearchTitle(rawName);
    return `https://www.themoviedb.org/search?query=${encodeURIComponent([parsed.title, parsed.year].filter(Boolean).join(' '))}`;
  }

  async resolveInfoUrl(rawName: string): Promise<string> {
    const fallbackUrl = this.getSearchUrlForName(rawName);
    if (!this.isEnabled()) {
      return fallbackUrl;
    }

    const parsed = this.cleanSearchTitle(rawName);

    try {
      const response = await this.getJson<TmdbListResponse<TmdbSearchResult>>('/search/multi', {
        query: parsed.title,
        include_adult: 'false',
      });
      const best = (response.results ?? [])
        .filter((result) => result.media_type === 'movie' || result.media_type === 'tv')
        .map((result) => ({
          result,
          score: this.scoreSearchResult(result, parsed.title, parsed.year),
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (!best || best.score < 45) {
        return fallbackUrl;
      }

      return `https://www.themoviedb.org/${best.result.media_type === 'movie' ? 'movie' : 'tv'}/${best.result.id}`;
    } catch (error) {
      logger.error({ error, rawName }, 'Failed to resolve TMDB info URL');
      return fallbackUrl;
    }
  }

  private async getRelatedForSeed(seed: { id: number; mediaType: 'movie' | 'show'; title: string }): Promise<TmdbMediaItem[]> {
    const pathType = seed.mediaType === 'movie' ? 'movie' : 'tv';
    const mediaType = seed.mediaType;
    const paths = [
      `/${pathType}/${seed.id}/recommendations`,
      `/${pathType}/${seed.id}/similar`,
    ];

    try {
      const responses = await Promise.all(
        paths.map((path) => this.getJson<TmdbListResponse<TmdbMediaResult>>(path, { page: '1' }))
      );
      const mapped = await Promise.all(
        responses
          .flatMap((response) => response.results ?? [])
          .map((result) => this.mapResult(result, mediaType, `Because you watched ${seed.title}`))
      );

      return mapped.filter((item): item is TmdbMediaItem => Boolean(item));
    } catch (error) {
      logger.error({ error, seed }, 'Failed to get related TMDB media');
      return [];
    }
  }

  private dedupe(items: TmdbMediaItem[]): TmdbMediaItem[] {
    const seen = new Set<string>();
    const uniqueItems: TmdbMediaItem[] = [];

    for (const item of items) {
      const key = `${item.mediaType}:${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  }

  async getCandidatesFromHistory(history: ViewingHistoryItem[]): Promise<TmdbMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const seeds = (await Promise.all(
      history.slice(0, 10).map((item) => this.searchWatchedItem(item))
    )).filter((seed): seed is { id: number; mediaType: 'movie' | 'show'; title: string } => Boolean(seed));

    const related = (await Promise.all(seeds.map((seed) => this.getRelatedForSeed(seed)))).flat();

    return this.dedupe(related)
      .sort((a, b) => (b.popularity + b.voteCount / 1000) - (a.popularity + a.voteCount / 1000));
  }

  async getTrending(mediaType: 'movie' | 'show', limit = 10): Promise<TmdbMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const pathType = mediaType === 'movie' ? 'movie' : 'tv';

    try {
      const response = await this.getJson<TmdbListResponse<TmdbMediaResult>>(
        `/trending/${pathType}/day`
      );
      const mapped = await Promise.all(
        (response.results ?? [])
          .slice(0, 30)
          .map((result) => this.mapResult(result, mediaType, 'Trending now on TMDB'))
      );

      return mapped
        .filter((item): item is TmdbMediaItem => Boolean(item))
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);
    } catch (error) {
      logger.error({ error, mediaType }, 'Failed to get TMDB trending media');
      return [];
    }
  }

  async getNowPlayingMovies(limit = 20): Promise<TmdbMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const response = await this.getJson<TmdbListResponse<TmdbMediaResult>>(
        '/movie/now_playing',
        {
          page: '1',
          region: 'US',
        }
      );
      const mapped = await Promise.all(
        (response.results ?? [])
          .slice(0, 30)
          .map((result) => this.mapResult(result, 'movie', 'Now playing in theaters'))
      );

      return mapped
        .filter((item): item is TmdbMediaItem => Boolean(item))
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);
    } catch (error) {
      logger.error({ error }, 'Failed to get TMDB now playing movies');
      return [];
    }
  }

  async getRecentlyReleasedMovies(limit = 20): Promise<TmdbMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 90);

    try {
      const response = await this.getJson<TmdbListResponse<TmdbMediaResult>>(
        '/discover/movie',
        {
          include_adult: 'false',
          page: '1',
          region: 'US',
          sort_by: 'primary_release_date.desc',
          'primary_release_date.gte': this.formatDate(startDate),
          'primary_release_date.lte': this.formatDate(today),
          'vote_count.gte': '10',
        }
      );
      const mapped = await Promise.all(
        (response.results ?? [])
          .slice(0, 40)
          .map((result) => this.mapResult(result, 'movie', 'Recently released'))
      );

      return mapped
        .filter((item): item is TmdbMediaItem => Boolean(item))
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.popularity - a.popularity)
        .slice(0, limit);
    } catch (error) {
      logger.error({ error }, 'Failed to get TMDB recently released movies');
      return [];
    }
  }

  async getCandidatesFromPrompt(
    prompt: string,
    history: ViewingHistoryItem[],
    limit = 20,
    preferences?: TmdbPromptPreferences
  ): Promise<TmdbMediaItem[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const parsedPrompt = await this.parsePrompt(prompt, history, preferences);
    const pathType = parsedPrompt.mediaType === 'movie' ? 'movie' : 'tv';
    const params: Record<string, string> = {
      include_adult: 'false',
      sort_by: 'popularity.desc',
      page: '1',
      'vote_count.gte': '50',
    };

    if (parsedPrompt.genreIds.length > 0) {
      params.with_genres = parsedPrompt.genreIds.join(',');
    }

    if (parsedPrompt.maxRuntime) {
      params['with_runtime.lte'] = String(parsedPrompt.maxRuntime);
    }

    try {
      const response = await this.getJson<TmdbListResponse<TmdbMediaResult>>(
        `/discover/${pathType}`,
        params
      );
      const mapped = await Promise.all(
        (response.results ?? [])
          .slice(0, 40)
          .map((result) => this.mapResult(result, parsedPrompt.mediaType, `Matched: ${prompt}`))
      );
      const candidates = mapped.filter((item): item is TmdbMediaItem => Boolean(item));
      const candidatesWithRuntime = await Promise.all(
        candidates.map(async (item) => ({
          ...item,
          runtimeMinutes: await this.getRuntimeMinutes(item.id, item.mediaType),
        }))
      );

      return candidatesWithRuntime
        .filter((item) => {
          if (!parsedPrompt.maxRuntime) {
            return true;
          }

          return item.runtimeMinutes === undefined || item.runtimeMinutes <= parsedPrompt.maxRuntime;
        })
        .sort((a, b) => (b.popularity + (b.rating ?? 0)) - (a.popularity + (a.rating ?? 0)))
        .slice(0, limit);
    } catch (error) {
      logger.error({ error, prompt }, 'Failed to get TMDB prompt recommendations');
      return [];
    }
  }
}

export const tmdbService = new TmdbService();
