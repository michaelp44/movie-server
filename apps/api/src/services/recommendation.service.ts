import type {
  Download,
  DownloadStatus,
  RecommendationItem,
  RecommendationSection,
} from '@movie-server/shared';
import { db } from '../db/index.js';
import { getDownloads } from './download.service.js';
import { mediaServerService } from './media-server.service.js';
import type { MediaItem, ViewingHistoryItem } from './media-server.types.js';
import { buildTasteProfile, scoreMediaItem } from './recommendation-scoring.js';
import { tmdbService, type TmdbMediaItem } from './tmdb.service.js';
import { getDismissedRecommendationIds } from './dismissed-recommendation.service.js';
import { openAiRecommendationService } from './openai-recommendation.service.js';

interface LibraryRecommendationRow {
  id: string;
  name: string;
  path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  download_id: string | null;
  user_id: string | null;
}

interface ScoredItem {
  item: RecommendationItem;
  score: number;
  genres: string[];
}

interface OwnedMediaIndex {
  titles: Set<string>;
  paths: Set<string>;
}

const ACTIVE_DOWNLOAD_STATUSES = new Set<DownloadStatus>([
  'QUEUED',
  'FETCHING_MAGNET',
  'ADDING_TO_QBITTORRENT',
  'DOWNLOADING',
  'PAUSED',
]);

const GENRE_SECTION_NAMES = [
  'Action',
  'Comedy',
  'Drama',
  'Crime',
  'Sci-Fi & Fantasy',
  'Thriller',
  'Romance',
  'Animation',
  'Documentary',
];

function uniqueById(items: RecommendationItem[]): RecommendationItem[] {
  const seen = new Set<string>();
  const uniqueItems: RecommendationItem[] = [];

  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

function compactTitle(rawName: string): { title: string; year?: number } {
  const withoutExtension = rawName.replace(/\.[a-z0-9]{2,5}$/i, '');
  const yearMatch = /\b(19\d{2}|20\d{2})\b/.exec(withoutExtension);
  const year = yearMatch?.[1] ? Number(yearMatch[1]) : undefined;
  const titlePart = withoutExtension
    .replace(/\b(19\d{2}|20\d{2})\b.*$/i, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b(720p|1080p|2160p|4k|bluray|web-dl|webrip|x264|x265|h264|h265)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: titlePart || rawName,
    year,
  };
}

function normalizeTitleForMatch(title: string): string {
  return compactTitle(title).title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function secondsToIso(seconds?: number): string | undefined {
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

function getMediaDisplayTitle(item: MediaItem): string {
  if (item.type === 'episode' && item.showTitle) {
    return `${item.showTitle}: ${item.title}`;
  }

  return item.title;
}

function mediaToRecommendationItem(item: MediaItem, reason?: string): RecommendationItem {
  return {
    id: `${item.source}:${item.ratingKey}`,
    title: getMediaDisplayTitle(item),
    type: item.type === 'other' ? 'file' : item.type,
    year: item.year,
    rating: item.rating,
    genres: item.genres,
    reason,
    posterUrl: item.thumb
      ? `/api/recommendations/poster?source=${item.source}&path=${encodeURIComponent(item.thumb)}`
      : undefined,
    durationMs: item.durationMs,
    watchedAt: secondsToIso(item.lastViewedAt),
    viewCount: item.viewCount,
    progressPercent: item.durationMs && item.viewOffsetMs
      ? Math.min(99, Math.round((item.viewOffsetMs / item.durationMs) * 100))
      : undefined,
    filePath: item.file,
    source: item.source,
  };
}

function downloadToRecommendationItem(download: Download): RecommendationItem {
  const parsed = compactTitle(download.name);

  return {
    id: `download:${download.id}`,
    title: parsed.title,
    type: 'download',
    year: parsed.year,
    genres: [],
    reason: download.status === 'PAUSED' ? 'Paused download' : 'In progress',
    progressPercent: download.progress,
    source: 'download',
  };
}

function diverseTopItems(scoredItems: ScoredItem[], limit: number): RecommendationItem[] {
  const genreCounts = new Map<string, number>();
  const sorted = [...scoredItems].sort((a, b) => b.score - a.score);
  const selected: RecommendationItem[] = [];

  for (const scored of sorted) {
    if (selected.length >= limit) {
      break;
    }

    const genrePenalty = scored.genres.reduce((penalty, genre) => {
      return penalty + ((genreCounts.get(genre.toLowerCase()) ?? 0) * 2);
    }, 0);

    if (scored.score - genrePenalty <= 0) {
      continue;
    }

    selected.push(scored.item);
    scored.genres.forEach((genre) => {
      const key = genre.toLowerCase();
      genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
    });
  }

  return selected;
}

function buildOwnedMediaIndex(
  downloads: Download[],
  libraryRows: LibraryRecommendationRow[],
  mediaLibraryItems: MediaItem[]
): OwnedMediaIndex {
  const titles = new Set<string>();
  const paths = new Set<string>();

  downloads.forEach((download) => {
    titles.add(normalizeTitleForMatch(download.name));
  });

  libraryRows.forEach((row) => {
    titles.add(normalizeTitleForMatch(row.name));
    paths.add(row.path);
  });

  mediaLibraryItems.forEach((item) => {
    titles.add(normalizeTitleForMatch(getMediaDisplayTitle(item)));
    if (item.file) {
      paths.add(item.file);
    }
  });

  titles.delete('');
  paths.delete('');

  return { titles, paths };
}

function isOwnedMedia(item: MediaItem, ownedMedia: OwnedMediaIndex): boolean {
  const title = normalizeTitleForMatch(getMediaDisplayTitle(item));

  return ownedMedia.titles.has(title) || Boolean(item.file && ownedMedia.paths.has(item.file));
}

function isOwnedTitle(title: string, ownedMedia: OwnedMediaIndex): boolean {
  return ownedMedia.titles.has(normalizeTitleForMatch(title));
}

function tmdbToRecommendationItem(item: TmdbMediaItem, reason?: string): RecommendationItem {
  return {
    id: `tmdb:${item.mediaType}:${item.id}`,
    title: item.title,
    type: item.mediaType === 'movie' ? 'movie' : 'show',
    year: item.year,
    rating: item.rating,
    genres: item.genres,
    reason: reason ?? item.reason,
    posterUrl: item.posterUrl,
    overview: item.overview,
    externalUrl: `https://www.themoviedb.org/${item.mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}`,
    durationMs: item.runtimeMinutes ? item.runtimeMinutes * 60 * 1000 : undefined,
    source: 'tmdb',
  };
}

function getLibraryRowsForUser(userId: string): LibraryRecommendationRow[] {
  const stmt = db.prepare(`
    SELECT
      library_files.id,
      library_files.name,
      library_files.path,
      library_files.size_bytes,
      library_files.mime_type,
      library_files.created_at,
      library_files.download_id,
      downloads.user_id
    FROM library_files
    LEFT JOIN downloads ON downloads.id = library_files.download_id
    WHERE downloads.user_id = ? OR library_files.download_id IS NULL
    ORDER BY library_files.created_at DESC
    LIMIT 100
  `);

  return stmt.all(userId) as LibraryRecommendationRow[];
}

function section(
  id: string,
  title: string,
  items: RecommendationItem[],
  reason?: string
): RecommendationSection | undefined {
  const uniqueItems = uniqueById(items).slice(0, 12);

  if (uniqueItems.length === 0) {
    return undefined;
  }

  return {
    id,
    title,
    reason,
    items: uniqueItems,
  };
}

function filterDismissedSections(
  sections: RecommendationSection[],
  dismissedIds: Set<string>
): RecommendationSection[] {
  return sections
    .map((sectionItem) => ({
      ...sectionItem,
      items: sectionItem.items.filter((item) => !dismissedIds.has(item.id)),
    }))
    .filter((sectionItem) => sectionItem.items.length > 0);
}

function buildMediaServerSections(
  candidates: MediaItem[],
  history: ViewingHistoryItem[],
  ownedMedia: OwnedMediaIndex
): RecommendationSection[] {
  const profile = buildTasteProfile(history);
  const unseenCandidates = candidates.filter((item) => {
    return !isOwnedMedia(item, ownedMedia)
      && !profile.watchedKeys.has(item.ratingKey)
      && !(item.file && profile.watchedFiles.has(item.file));
  });
  const scored = unseenCandidates.map((item) => ({
    item: mediaToRecommendationItem(item, 'Related to your media server watch history'),
    score: scoreMediaItem(item, profile),
    genres: item.genres,
  }));
  const sections: RecommendationSection[] = [];
  const anchor = profile.recentWatched[0];

  if (anchor) {
    const anchorGenres = new Set(anchor.genres.map((genre) => genre.toLowerCase()));
    const anchorPeople = new Set([...anchor.actors, ...anchor.directors, ...anchor.writers].map((person) => person.toLowerCase()));
    const becauseItems = unseenCandidates
      .map((item) => {
        const genreOverlap = item.genres.filter((genre) => anchorGenres.has(genre.toLowerCase())).length;
        const peopleOverlap = [...item.actors, ...item.directors, ...item.writers]
          .filter((person) => anchorPeople.has(person.toLowerCase())).length;

        return {
          item: mediaToRecommendationItem(item, `Because you watched ${getMediaDisplayTitle(anchor)}`),
          score: (genreOverlap * 10) + (peopleOverlap * 6) + (item.rating ?? 0),
          genres: item.genres,
        };
      });

    const becauseSection = section(
      'because-you-watched',
      `Because you watched ${getMediaDisplayTitle(anchor)}`,
      diverseTopItems(becauseItems, 12),
      'Based on recent media server viewing'
    );
    if (becauseSection) {
      sections.push(becauseSection);
    }
  }

  const similarSection = section(
    'similar-to-shows-you-like',
    'Similar to shows you like',
    diverseTopItems(scored, 12),
    'Uses genre, cast, director, rating, and recency signals from Plex and Jellyfin'
  );
  if (similarSection) {
    sections.push(similarSection);
  }

  const popularSection = section(
    'popular-in-your-library',
    'Popular in your library',
    unseenCandidates
      .filter((item) => item.viewCount > 0 || item.rating)
      .sort((a, b) => ((b.viewCount * 10) + (b.rating ?? 0)) - ((a.viewCount * 10) + (a.rating ?? 0)))
      .map((item) => mediaToRecommendationItem(item, 'Popular or highly rated in your media library')),
    'Uses related titles, view count, and rating when available'
  );
  if (popularSection) {
    sections.push(popularSection);
  }

  const hiddenGemsSection = section(
    'hidden-gems',
    'Hidden gems',
    unseenCandidates
      .filter((item) => (item.rating ?? 0) >= 7 && item.viewCount === 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((item) => mediaToRecommendationItem(item, 'Highly rated and unwatched')),
    'Highly rated related titles you have not downloaded yet'
  );
  if (hiddenGemsSection) {
    sections.push(hiddenGemsSection);
  }

  return sections;
}

function buildTmdbSections(
  candidates: TmdbMediaItem[],
  history: ViewingHistoryItem[],
  ownedMedia: OwnedMediaIndex
): RecommendationSection[] {
  const ownedAndWatchedTitles = new Set(ownedMedia.titles);

  history.forEach((item) => {
    ownedAndWatchedTitles.add(normalizeTitleForMatch(getMediaDisplayTitle(item)));
    if (item.type === 'episode' && item.showTitle) {
      ownedAndWatchedTitles.add(normalizeTitleForMatch(item.showTitle));
    }
  });

  const unseenCandidates = candidates.filter((item) => {
    return !ownedAndWatchedTitles.has(normalizeTitleForMatch(item.title))
      && !isOwnedTitle(item.title, ownedMedia);
  });
  const sections: RecommendationSection[] = [];
  const anchor = history[0];

  if (anchor) {
    const anchorTitle = anchor.type === 'episode' && anchor.showTitle ? anchor.showTitle : anchor.title;
    const becauseItems = unseenCandidates
      .filter((item) => item.reason?.toLowerCase().includes(anchorTitle.toLowerCase()) ?? false)
      .sort((a, b) => b.popularity - a.popularity)
      .map((item) => tmdbToRecommendationItem(item));
    const becauseSection = section(
      'because-you-watched',
      `Because you watched ${getMediaDisplayTitle(anchor)}`,
      becauseItems,
      'New TMDB titles related to recent viewing'
    );

    if (becauseSection) {
      sections.push(becauseSection);
    }
  }

  const topPicksSection = section(
    'top-new-ideas',
    'Top new ideas',
    unseenCandidates
      .sort((a, b) => (b.popularity + b.voteCount / 1000 + (b.rating ?? 0)) - (a.popularity + a.voteCount / 1000 + (a.rating ?? 0)))
      .map((item) => tmdbToRecommendationItem(item, 'Recommended by TMDB from your watch history')),
    'External recommendations filtered against your downloads and media library'
  );
  if (topPicksSection) {
    sections.push(topPicksSection);
  }

  const hiddenGemsSection = section(
    'hidden-gems',
    'Hidden gems',
    unseenCandidates
      .filter((item) => (item.rating ?? 0) >= 7 && item.voteCount >= 50)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((item) => tmdbToRecommendationItem(item, 'Highly rated title you do not have yet')),
    'Higher-rated TMDB titles outside your current library'
  );
  if (hiddenGemsSection) {
    sections.push(hiddenGemsSection);
  }

  const moviesSection = section(
    'movies-you-might-like',
    'Movies you might like',
    unseenCandidates
      .filter((item) => item.mediaType === 'movie')
      .sort((a, b) => b.popularity - a.popularity)
      .map((item) => tmdbToRecommendationItem(item, 'Movie idea from TMDB')),
    'Movie recommendations you have not downloaded'
  );
  if (moviesSection) {
    sections.push(moviesSection);
  }

  const showsSection = section(
    'shows-you-might-like',
    'Shows you might like',
    unseenCandidates
      .filter((item) => item.mediaType === 'show')
      .sort((a, b) => b.popularity - a.popularity)
      .map((item) => tmdbToRecommendationItem(item, 'TV idea from TMDB')),
    'TV recommendations you have not downloaded'
  );
  if (showsSection) {
    sections.push(showsSection);
  }

  return sections;
}

function buildTrendingSections(
  trendingMovies: TmdbMediaItem[],
  trendingShows: TmdbMediaItem[],
  history: ViewingHistoryItem[],
  ownedMedia: OwnedMediaIndex
): RecommendationSection[] {
  const blockedTitles = new Set(ownedMedia.titles);

  history.forEach((item) => {
    blockedTitles.add(normalizeTitleForMatch(getMediaDisplayTitle(item)));
    if (item.type === 'episode' && item.showTitle) {
      blockedTitles.add(normalizeTitleForMatch(item.showTitle));
    }
  });

  const filterItems = (items: TmdbMediaItem[]) => {
    return items
      .filter((item) => !blockedTitles.has(normalizeTitleForMatch(item.title)))
      .map((item) => tmdbToRecommendationItem(item, 'Trending now on TMDB'));
  };
  const sections: RecommendationSection[] = [];
  const moviesSection = section(
    'top-10-movies',
    'Top 10 Movies Today',
    filterItems(trendingMovies).slice(0, 10),
    'Trending movie ideas you have not downloaded'
  );
  const showsSection = section(
    'top-10-tv-shows',
    'Top 10 TV Shows Today',
    filterItems(trendingShows).slice(0, 10),
    'Trending TV ideas you have not downloaded'
  );

  if (moviesSection) {
    sections.push(moviesSection);
  }

  if (showsSection) {
    sections.push(showsSection);
  }

  return sections;
}

function buildNowPlayingSection(
  nowPlayingMovies: TmdbMediaItem[],
  history: ViewingHistoryItem[],
  ownedMedia: OwnedMediaIndex
): RecommendationSection[] {
  const blockedTitles = buildBlockedTitles(history, ownedMedia);
  const nowPlayingSection = section(
    'now-playing-movies',
    'New Movies in Cinemas',
    nowPlayingMovies
      .filter((item) => !blockedTitles.has(normalizeTitleForMatch(item.title)))
      .map((item) => tmdbToRecommendationItem(item, 'Currently playing in cinemas')),
    'New theatrical releases you have not downloaded'
  );

  return nowPlayingSection ? [nowPlayingSection] : [];
}

function buildRecentlyReleasedSection(
  recentlyReleasedMovies: TmdbMediaItem[],
  history: ViewingHistoryItem[],
  ownedMedia: OwnedMediaIndex
): RecommendationSection[] {
  const blockedTitles = buildBlockedTitles(history, ownedMedia);
  const recentlyReleasedSection = section(
    'recently-released-movies',
    'Recently Released',
    recentlyReleasedMovies
      .filter((item) => !blockedTitles.has(normalizeTitleForMatch(item.title)))
      .map((item) => tmdbToRecommendationItem(item, 'Released in the last few months')),
    'Newer movie releases you have not downloaded'
  );

  return recentlyReleasedSection ? [recentlyReleasedSection] : [];
}

function buildGenreSections(
  candidates: TmdbMediaItem[],
  trendingMovies: TmdbMediaItem[],
  trendingShows: TmdbMediaItem[],
  history: ViewingHistoryItem[],
  ownedMedia: OwnedMediaIndex
): RecommendationSection[] {
  const blockedTitles = new Set(ownedMedia.titles);

  history.forEach((item) => {
    blockedTitles.add(normalizeTitleForMatch(getMediaDisplayTitle(item)));
    if (item.type === 'episode' && item.showTitle) {
      blockedTitles.add(normalizeTitleForMatch(item.showTitle));
    }
  });

  const pool = [...candidates, ...trendingMovies, ...trendingShows]
    .filter((item) => !blockedTitles.has(normalizeTitleForMatch(item.title)));
  const sections: RecommendationSection[] = [];

  for (const genreName of GENRE_SECTION_NAMES) {
    const genreKey = genreName.toLowerCase();
    const genreItems = pool
      .filter((item) => item.genres.some((genre) => {
        const normalizedGenre = genre.toLowerCase();
        return normalizedGenre === genreKey || normalizedGenre.includes(genreKey);
      }))
      .sort((a, b) => (b.popularity + (b.rating ?? 0)) - (a.popularity + (a.rating ?? 0)))
      .map((item) => tmdbToRecommendationItem(item, `${genreName} idea from TMDB`));
    const genreSection = section(
      `genre-${genreName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      genreName,
      genreItems,
      `${genreName} movies and shows you have not downloaded`
    );

    if (genreSection && genreSection.items.length >= 4) {
      sections.push(genreSection);
    }
  }

  return sections;
}

function buildBlockedTitles(history: ViewingHistoryItem[], ownedMedia: OwnedMediaIndex): Set<string> {
  const blockedTitles = new Set(ownedMedia.titles);

  history.forEach((item) => {
    blockedTitles.add(normalizeTitleForMatch(getMediaDisplayTitle(item)));
    if (item.type === 'episode' && item.showTitle) {
      blockedTitles.add(normalizeTitleForMatch(item.showTitle));
    }
  });

  return blockedTitles;
}

function filterDismissedItems(
  items: TmdbMediaItem[],
  dismissedIds: Set<string>
): TmdbMediaItem[] {
  return items.filter((item) => !dismissedIds.has(`tmdb:${item.mediaType}:${item.id}`));
}

function buildContinueWatchingSection(downloads: Download[]): RecommendationSection[] {
  const sections: RecommendationSection[] = [];
  const activeDownloads = downloads
    .filter((download) => ACTIVE_DOWNLOAD_STATUSES.has(download.status))
    .map(downloadToRecommendationItem);

  const continueSection = section(
    'continue-watching',
    'Continue watching',
    activeDownloads,
    'Downloads that are still in progress'
  );
  if (continueSection) {
    sections.push(continueSection);
  }

  return sections;
}

export async function getRecommendationsForUser(userId: string): Promise<RecommendationSection[]> {
  const downloads = getDownloads(userId, 1, 100).items;
  const libraryRows = getLibraryRowsForUser(userId);
  const dismissedIds = getDismissedRecommendationIds(userId);
  const [history, mediaItems] = await Promise.all([
    mediaServerService.getViewingHistory(100),
    mediaServerService.getAllMediaMetadata(),
  ]);
  const relatedMedia = (await Promise.all(
    history.slice(0, 8).map((item) => mediaServerService.getRelatedMedia(item))
  )).flat();
  const [
    tmdbCandidates,
    trendingMovies,
    trendingShows,
    nowPlayingMovies,
    recentlyReleasedMovies,
  ] = await Promise.all([
    tmdbService.getCandidatesFromHistory(history),
    tmdbService.getTrending('movie', 20),
    tmdbService.getTrending('show', 20),
    tmdbService.getNowPlayingMovies(20),
    tmdbService.getRecentlyReleasedMovies(20),
  ]);
  const ownedMedia = buildOwnedMediaIndex(downloads, libraryRows, mediaItems);

  const sections = [
    ...buildContinueWatchingSection(downloads),
    ...buildTrendingSections(
      filterDismissedItems(trendingMovies, dismissedIds),
      filterDismissedItems(trendingShows, dismissedIds),
      history,
      ownedMedia
    ),
    ...buildNowPlayingSection(
      filterDismissedItems(nowPlayingMovies, dismissedIds),
      history,
      ownedMedia
    ),
    ...buildRecentlyReleasedSection(
      filterDismissedItems(recentlyReleasedMovies, dismissedIds),
      history,
      ownedMedia
    ),
    ...buildGenreSections(
      filterDismissedItems(tmdbCandidates, dismissedIds),
      filterDismissedItems(trendingMovies, dismissedIds),
      filterDismissedItems(trendingShows, dismissedIds),
      history,
      ownedMedia
    ),
    ...buildTmdbSections(tmdbCandidates, history, ownedMedia),
    ...buildMediaServerSections(relatedMedia, history, ownedMedia),
  ];

  return filterDismissedSections(sections, dismissedIds).slice(0, 14);
}

export async function getPromptRecommendationsForUser(
  userId: string,
  prompt: string
): Promise<RecommendationSection[]> {
  const downloads = getDownloads(userId, 1, 100).items;
  const libraryRows = getLibraryRowsForUser(userId);
  const dismissedIds = getDismissedRecommendationIds(userId);
  const [history, mediaItems] = await Promise.all([
    mediaServerService.getViewingHistory(100),
    mediaServerService.getAllMediaMetadata(),
  ]);
  const ownedMedia = buildOwnedMediaIndex(downloads, libraryRows, mediaItems);
  const blockedTitles = buildBlockedTitles(history, ownedMedia);
  const promptPreferences = await openAiRecommendationService.getPromptPreferences(prompt, history);
  const promptCandidates = await tmdbService.getCandidatesFromPrompt(prompt, history, 30, promptPreferences);
  const filteredCandidates = promptCandidates
    .filter((item) => !dismissedIds.has(`tmdb:${item.mediaType}:${item.id}`))
    .filter((item) => !blockedTitles.has(normalizeTitleForMatch(item.title)));
  const aiRanking = await openAiRecommendationService.rankPromptCandidates(prompt, history, filteredCandidates);
  const candidatesById = new Map(
    filteredCandidates.map((item) => [`${item.mediaType}:${item.id}`, item])
  );
  const rankedItems = aiRanking
    .map((ranked) => {
      const candidate = candidatesById.get(ranked.id);
      return candidate ? tmdbToRecommendationItem(candidate, ranked.reason) : undefined;
    })
    .filter((item): item is RecommendationItem => Boolean(item));
  const rankedIds = new Set(aiRanking.map((ranked) => ranked.id));
  const fallbackItems = filteredCandidates
    .filter((item) => !rankedIds.has(`${item.mediaType}:${item.id}`))
    .map((item) => tmdbToRecommendationItem(item, `Matched: ${prompt}`));
  const promptItems = [...rankedItems, ...fallbackItems];
  const promptSection = section(
    'prompt-recommendations',
    'Based on your prompt',
    promptItems,
    openAiRecommendationService.isEnabled()
      ? `ChatGPT ranked TMDB results for: ${prompt}`
      : `Prompt: ${prompt}`
  );

  return promptSection ? [promptSection] : [];
}
