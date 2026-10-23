import { config } from '../config.js';
import { logger } from '../logger.js';
import { fetchWithDns } from '../utils/http-client.js';
import type { ViewingHistoryItem } from './media-server.types.js';
import type { TmdbMediaItem, TmdbPromptPreferences } from './tmdb.service.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface PromptPlanResponse {
  mediaType?: 'movie' | 'show' | 'any';
  genres?: string[];
  maxRuntimeMinutes?: number | null;
  keywords?: string[];
}

interface RankedCandidateResponse {
  ranked: Array<{
    id: string;
    reason: string;
  }>;
}

interface RankedCandidate {
  id: string;
  reason: string;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
  'War',
  'Western',
];

function historySummary(history: ViewingHistoryItem[]) {
  return history.slice(0, 20).map((item) => ({
    title: item.type === 'episode' && item.showTitle ? item.showTitle : item.title,
    type: item.type === 'movie' ? 'movie' : 'show',
    year: item.year,
    genres: item.genres.slice(0, 5),
  }));
}

function candidateSummary(candidates: TmdbMediaItem[]) {
  return candidates.slice(0, 25).map((item) => ({
    id: `${item.mediaType}:${item.id}`,
    title: item.title,
    type: item.mediaType,
    year: item.year,
    rating: item.rating,
    genres: item.genres.slice(0, 5),
    runtimeMinutes: item.runtimeMinutes,
    overview: item.overview?.slice(0, 400),
  }));
}

function parseJsonContent<T>(content?: string): T | undefined {
  if (!content) {
    return undefined;
  }

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    logger.warn({ error }, 'OpenAI returned non-JSON recommendation content');
    return undefined;
  }
}

class OpenAiRecommendationService {
  private apiKey = config.openai.apiKey;
  private model = config.openai.model;

  isEnabled(): boolean {
    return this.apiKey.length > 0;
  }

  private async createJsonCompletion<T>(
    name: string,
    schema: Record<string, unknown>,
    messages: Array<{ role: 'system' | 'user'; content: string }>
  ): Promise<T | undefined> {
    if (!this.isEnabled()) {
      return undefined;
    }

    try {
      const response = await fetchWithDns(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name,
              strict: true,
              schema,
            },
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        logger.warn({ status: response.status, body }, 'OpenAI recommendation request failed');
        return undefined;
      }

      const data = await response.json<ChatCompletionResponse>();
      return parseJsonContent<T>(data.choices?.[0]?.message?.content);
    } catch (error) {
      logger.warn({ error }, 'OpenAI recommendation request failed');
      return undefined;
    }
  }

  async getPromptPreferences(
    prompt: string,
    history: ViewingHistoryItem[]
  ): Promise<TmdbPromptPreferences | undefined> {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        mediaType: { type: 'string', enum: ['movie', 'show', 'any'] },
        genres: {
          type: 'array',
          items: { type: 'string', enum: GENRES },
          maxItems: 4,
        },
        maxRuntimeMinutes: { type: ['integer', 'null'], minimum: 1, maximum: 300 },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 8,
        },
      },
      required: ['mediaType', 'genres', 'maxRuntimeMinutes', 'keywords'],
    };
    const result = await this.createJsonCompletion<PromptPlanResponse>(
      'movie_prompt_preferences',
      schema,
      [
        {
          role: 'system',
          content: 'Convert the user request into movie/TV discovery filters. Prefer explicit user intent, then use watch history only to fill missing taste signals.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            prompt,
            availableGenres: GENRES,
            watchHistory: historySummary(history),
          }),
        },
      ]
    );

    if (!result) {
      return undefined;
    }

    return {
      mediaType: result.mediaType === 'any' ? undefined : result.mediaType,
      genres: result.genres ?? [],
      maxRuntimeMinutes: result.maxRuntimeMinutes ?? undefined,
      keywords: result.keywords ?? [],
    };
  }

  async rankPromptCandidates(
    prompt: string,
    history: ViewingHistoryItem[],
    candidates: TmdbMediaItem[]
  ): Promise<RankedCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        ranked: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['id', 'reason'],
          },
        },
      },
      required: ['ranked'],
    };
    const result = await this.createJsonCompletion<RankedCandidateResponse>(
      'movie_prompt_ranking',
      schema,
      [
        {
          role: 'system',
          content: 'Rank the provided TMDB candidates for the user. Only use candidate IDs from the input. Prefer titles matching the prompt, compatible with watch history, and not too repetitive. Reasons must be short.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            prompt,
            watchHistory: historySummary(history),
            candidates: candidateSummary(candidates),
          }),
        },
      ]
    );

    return result?.ranked ?? [];
  }
}

export const openAiRecommendationService = new OpenAiRecommendationService();
