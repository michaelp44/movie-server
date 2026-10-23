'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { WantedDownload, WantedDownloadQuality } from '@movie-server/shared';
import {
  cancelWantedDownload,
  checkWantedDownload,
  createWantedDownload,
  getWantedDownloads,
} from '@/lib/api';

function formatDate(value?: string): string {
  if (!value) {
    return 'Not checked yet';
  }

  return new Date(value).toLocaleString();
}

function statusClass(status: WantedDownload['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
    case 'DOWNLOADED':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200';
    case 'FAILED':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
    case 'CANCELED':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  }
}

export default function WantedPage() {
  const [items, setItems] = useState<WantedDownload[]>([]);
  const [title, setTitle] = useState('');
  const [minQuality, setMinQuality] = useState<WantedDownloadQuality>('1080p');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async () => {
    try {
      const nextItems = await getWantedDownloads();
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auto downloads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const item = await createWantedDownload({
        title: normalizedTitle,
        year: new Date().getFullYear(),
        mediaType: 'movie',
        minQuality,
      });
      setItems((current) => {
        const existingIndex = current.findIndex((currentItem) => currentItem.id === item.id);
        if (existingIndex === -1) {
          return [item, ...current];
        }

        return current.map((currentItem) => (currentItem.id === item.id ? item : currentItem));
      });
      setTitle('');
      setMinQuality('1080p');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add auto download');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (nextItem: WantedDownload) => {
    setItems((current) => current.map((item) => (item.id === nextItem.id ? nextItem : item)));
  };

  const handleCheck = async (id: string) => {
    setError('');
    try {
      updateItem(await checkWantedDownload(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check auto download');
    }
  };

  const handleCancel = async (id: string) => {
    setError('');
    try {
      updateItem(await cancelWantedDownload(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel auto download');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Auto Downloads
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add a movie once. The server checks daily and downloads it when a clean release appears.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Movie title"
            className="input"
          />
          <select
            value={minQuality}
            onChange={(event) => setMinQuality(event.target.value as WantedDownloadQuality)}
            className="input"
          >
            <option value="720p">720p+</option>
            <option value="1080p">1080p+</option>
            <option value="2160p">2160p</option>
          </select>
          <button type="submit" disabled={saving} className="btn btn-primary min-h-11">
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          No auto downloads yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {item.title}{item.year ? ` (${item.year})` : ''}
                    </h2>
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                    <p>Minimum quality: {item.minQuality}+</p>
                    <p>Last checked: {formatDate(item.lastCheckedAt)}</p>
                    {item.matchedTitle && <p>Matched: {item.matchedTitle}</p>}
                    {item.lastError && <p className="text-red-600 dark:text-red-400">{item.lastError}</p>}
                  </div>
                </div>

                <div className="flex gap-2">
                  {item.status === 'ACTIVE' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCheck(item.id)}
                        className="btn btn-secondary text-sm"
                      >
                        Check now
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(item.id)}
                        className="btn btn-danger text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
