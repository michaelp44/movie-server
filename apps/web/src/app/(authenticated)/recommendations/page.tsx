'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type {
  RecommendationItem,
  RecommendationSection,
  WantedDownloadAvailability,
} from '@movie-server/shared';
import {
  createWantedDownload,
  dismissRecommendation,
  getPromptRecommendations,
  getRecommendations,
  getWantedDownloadAvailability,
} from '@/lib/api';

const NEW_RELEASE_SECTION_IDS = new Set(['now-playing-movies', 'recently-released-movies']);

function formatDuration(durationMs?: number): string | null {
  if (!durationMs) {
    return null;
  }

  const minutes = Math.round(durationMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

function formatRating(rating?: number): string | null {
  if (!rating) {
    return null;
  }

  return rating > 10 ? `${Math.round(rating)}%` : `${rating.toFixed(1)}/10`;
}

function MediaCard({
  item,
  onDismiss,
  onAddWanted,
  rank,
  wantedAvailability,
  addingWanted,
}: {
  item: RecommendationItem;
  onDismiss: (item: RecommendationItem) => void;
  onAddWanted?: (item: RecommendationItem) => void;
  rank?: number;
  wantedAvailability?: WantedDownloadAvailability;
  addingWanted?: boolean;
}) {
  const duration = formatDuration(item.durationMs);
  const rating = formatRating(item.rating);
  const initials = item.title.slice(0, 1).toUpperCase();
  const canAddAutoDownload = Boolean(wantedAvailability?.canAddWanted && onAddWanted);

  return (
    <article className="card p-0 overflow-hidden flex flex-col">
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-700 dark:to-gray-900 flex items-center justify-center">
        {rank !== undefined && (
          <span className="absolute left-2 top-2 z-10 inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-black/80 px-2 text-sm font-bold text-white shadow-sm ring-1 ring-white/30">
            {rank}
          </span>
        )}
        {item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.posterUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-5xl font-bold text-white/80">{initials}</span>
        )}
      </div>
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 flex flex-1 flex-col">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
            {item.title}
          </h3>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {item.year && <span>{item.year}</span>}
            {rating && <span>{rating}</span>}
            {duration && <span>{duration}</span>}
          </div>
        </div>

        {item.progressPercent !== undefined && item.progressPercent > 0 && (
          <div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-blue-600"
                style={{ width: `${Math.min(100, item.progressPercent)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {item.progressPercent}% complete
            </p>
          </div>
        )}

        {item.genres.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1">
            {item.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {item.reason && (
          <p className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {item.reason}
          </p>
        )}

        {item.overview && (
          <p className="hidden md:block text-sm text-gray-500 dark:text-gray-400 line-clamp-3">
            {item.overview}
          </p>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          {canAddAutoDownload && (
            <button
              type="button"
              onClick={() => onAddWanted?.(item)}
              disabled={addingWanted}
              className="col-span-2 min-h-10 inline-flex items-center justify-center rounded-md bg-emerald-600 px-2 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {addingWanted ? 'Adding...' : 'Auto Download'}
            </button>
          )}

          {item.source === 'tmdb' && !canAddAutoDownload && (
            <Link
              href={`/?q=${encodeURIComponent(item.title)}&autoSearch=1`}
              className="min-h-10 inline-flex items-center justify-center rounded-md bg-blue-600 px-2 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Search
            </Link>
          )}

          <button
            type="button"
            onClick={() => onDismiss(item)}
            className="min-h-10 inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            title="Mark as already watched"
          >
            Watched
          </button>

          {item.externalUrl && (
            <a
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="col-span-2 min-h-9 inline-flex items-center justify-center rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-gray-700"
            >
              Info
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function RecommendationRow({
  section,
  onDismiss,
  onAddWanted,
  wantedAvailability,
  addingWantedId,
}: {
  section: RecommendationSection;
  onDismiss: (item: RecommendationItem) => void;
  onAddWanted?: (item: RecommendationItem) => void;
  wantedAvailability: Record<string, WantedDownloadAvailability>;
  addingWantedId?: string;
}) {
  const showRank = section.id.startsWith('top-10');
  const showWantedActions = NEW_RELEASE_SECTION_IDS.has(section.id);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
          {section.title}
        </h2>
        {section.reason && (
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {section.reason}
          </p>
        )}
      </div>
      <div className="-mx-4 sm:mx-0 overflow-x-auto pb-2">
        <div className="flex gap-3 sm:gap-4 px-4 sm:px-0 snap-x snap-mandatory">
        {section.items.map((item, index) => (
          <div key={item.id} className="w-[42vw] max-w-[170px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] snap-start">
            <MediaCard
              item={item}
              onDismiss={onDismiss}
              onAddWanted={showWantedActions ? onAddWanted : undefined}
              wantedAvailability={showWantedActions ? wantedAvailability[item.id] : undefined}
              addingWanted={addingWantedId === item.id}
              rank={showRank ? index + 1 : undefined}
            />
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

export default function RecommendationsPage() {
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [promptSections, setPromptSections] = useState<RecommendationSection[]>([]);
  const [wantedAvailability, setWantedAvailability] = useState<Record<string, WantedDownloadAvailability>>({});
  const [addingWantedId, setAddingWantedId] = useState<string | undefined>();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [promptLoading, setPromptLoading] = useState(false);
  const [error, setError] = useState('');

  const removeItemFromSections = (itemId: string) => {
    setSections((currentSections) =>
      currentSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.id !== itemId),
        }))
        .filter((section) => section.items.length > 0)
    );
  };

  const handleDismiss = async (item: RecommendationItem) => {
    const previousSections = sections;
    const previousPromptSections = promptSections;
    removeItemFromSections(item.id);
    setPromptSections((currentSections) =>
      currentSections
        .map((section) => ({
          ...section,
          items: section.items.filter((sectionItem) => sectionItem.id !== item.id),
        }))
        .filter((section) => section.items.length > 0)
    );
    setError('');

    try {
      await dismissRecommendation({
        itemId: item.id,
        title: item.title,
        source: item.source,
        reason: 'already_watched',
      });
    } catch (err) {
      setSections(previousSections);
      setPromptSections(previousPromptSections);
      setError(err instanceof Error ? err.message : 'Failed to hide recommendation');
    }
  };

  const handlePromptSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    setError('');
    setPromptLoading(true);

    try {
      const nextSections = await getPromptRecommendations(prompt);
      setPromptSections(nextSections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get prompt recommendations');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleAddWanted = async (item: RecommendationItem) => {
    setAddingWantedId(item.id);
    setError('');

    try {
      await createWantedDownload({
        title: item.title,
        year: item.year,
        mediaType: item.type === 'show' ? 'show' : 'movie',
        minQuality: '1080p',
      });

      setWantedAvailability((current) => ({
        ...current,
        [item.id]: {
          ...(current[item.id] ?? {
            itemId: item.id,
            title: item.title,
            year: item.year,
            hasGoodQuality: false,
          }),
          alreadyWanted: true,
          canAddWanted: false,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add auto download');
    } finally {
      setAddingWantedId(undefined);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadRecommendations() {
      try {
        const nextSections = await getRecommendations();
        if (mounted) {
          setSections(nextSections);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load recommendations');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const newReleaseItems = sections
      .filter((section) => NEW_RELEASE_SECTION_IDS.has(section.id))
      .flatMap((section) => section.items)
      .filter((item) => item.source === 'tmdb')
      .slice(0, 30);

    if (newReleaseItems.length === 0) {
      return () => {
        mounted = false;
      };
    }

    async function loadWantedAvailability() {
      try {
        const items = await getWantedDownloadAvailability({
          minQuality: '1080p',
          items: newReleaseItems.map((item) => ({
            id: item.id,
            title: item.title,
            year: item.year,
          })),
        });

        if (!mounted) {
          return;
        }

        setWantedAvailability((current) => ({
          ...current,
          ...Object.fromEntries(items.map((item) => [item.itemId, item])),
        }));
      } catch {
        // Recommendations should still be usable if the torrent index is temporarily unavailable.
      }
    }

    loadWantedAvailability();

    return () => {
      mounted = false;
    };
  }, [sections]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-7 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Recommendations
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
          New movie and TV ideas from TMDB, filtered against your Plex library and downloads.
        </p>
      </div>

      <form onSubmit={handlePromptSearch} className="card p-4 sm:p-5 space-y-3">
        <label htmlFor="recommendation-prompt" className="block text-sm font-medium text-gray-900 dark:text-white">
          Ask for something specific
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="recommendation-prompt"
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Comedy TV show, episodes under 20 minutes"
            className="input"
          />
          <button
            type="submit"
            disabled={promptLoading || !prompt.trim()}
            className="btn btn-primary min-h-11 whitespace-nowrap"
          >
            {promptLoading ? 'Finding...' : 'Find'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {!error && sections.length === 0 && promptSections.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          No new recommendations yet. Add a TMDB API key and make sure Plex viewing history is available.
        </div>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          {promptSections.map((section) => (
            <RecommendationRow
              key={section.id}
              section={section}
              onDismiss={handleDismiss}
              onAddWanted={handleAddWanted}
              wantedAvailability={wantedAvailability}
              addingWantedId={addingWantedId}
            />
          ))}
          {sections.map((section) => (
            <RecommendationRow
              key={section.id}
              section={section}
              onDismiss={handleDismiss}
              onAddWanted={handleAddWanted}
              wantedAvailability={wantedAvailability}
              addingWantedId={addingWantedId}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}
