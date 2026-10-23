'use client';

import { useCallback, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ProviderSearchResult } from '@movie-server/shared';
import { searchProvider, confirmDownload, getProviders } from '@/lib/api';
import { SearchResults } from '@/components/SearchResults';
import { useEffect } from 'react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('piratebay');
  const [providers, setProviders] = useState<Array<{ name: string; displayName: string }>>([]);
  const [results, setResults] = useState<ProviderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    getProviders().then(setProviders).catch(console.error);
  }, []);

  const runSearch = useCallback(async (searchQuery: string, providerName: string) => {
    if (!searchQuery.trim()) return;

    setError('');
    setSuccess('');
    setSearching(true);
    setResults([]);

    try {
      const searchResults = await searchProvider(searchQuery, providerName);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const requestedQuery = searchParams.get('q');
    const shouldAutoSearch = searchParams.get('autoSearch') === '1';

    if (!requestedQuery || !shouldAutoSearch || providers.length === 0) {
      return;
    }

    const requestedProvider = searchParams.get('provider');
    const nextProvider = providers.some((item) => item.name === requestedProvider)
      ? requestedProvider!
      : provider;

    setQuery(requestedQuery);
    setProvider(nextProvider);
    runSearch(requestedQuery, nextProvider);
    router.replace(`/?q=${encodeURIComponent(requestedQuery)}`);
  }, [provider, providers, router, runSearch, searchParams]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await runSearch(query, provider);
  };

  const handleConfirm = async (result: ProviderSearchResult) => {
    setError('');
    setSuccess('');
    setConfirming(true);

    try {
      await confirmDownload(result.provider, result.id);
      setSuccess(`"${result.title}" is downloading in the background.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start download');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Search
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Search for movies or TV shows to download
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for movies or TV shows..."
                className="input"
              />
            </div>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="input sm:w-48"
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="btn btn-primary"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg">
            {success}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Search Results for "{query}"
          </h2>
          <SearchResults
            results={results}
            onConfirm={handleConfirm}
            loading={confirming}
          />
        </div>
      )}
    </div>
  );
}
