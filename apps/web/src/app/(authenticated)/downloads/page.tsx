'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Download, DownloadProgressPayload, DownloadStatusChangePayload } from '@movie-server/shared';
import { getDownloads, pauseDownload, resumeDownload, cancelDownload, deleteDownload } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDownloads = useCallback(async () => {
    try {
      const data = await getDownloads();
      setDownloads(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 5000);
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  useEffect(() => {
    const unsubProgress = wsClient.onProgress((payload: DownloadProgressPayload) => {
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === payload.downloadId
            ? { ...d, progress: payload.progress, downloadedBytes: payload.downloadedBytes, eta: payload.eta }
            : d
        )
      );
    });

    const unsubStatus = wsClient.onStatusChange((payload: DownloadStatusChangePayload) => {
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === payload.downloadId
            ? { ...d, status: payload.status, errorMessage: payload.errorMessage }
            : d
        )
      );
    });

    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, []);

  const handlePause = async (id: string) => {
    try {
      const updated = await pauseDownload(id);
      setDownloads((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause');
    }
  };

  const handleResume = async (id: string) => {
    try {
      const updated = await resumeDownload(id);
      setDownloads((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this download?')) return;
    try {
      const updated = await cancelDownload(id);
      setDownloads((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this download and its files?')) return;
    try {
      await deleteDownload(id);
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Downloads</h1>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {downloads.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          No downloads yet. Search for movies or TV shows to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((download) => (
            <div key={download.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 dark:text-white break-all">
                      {download.name}
                    </h3>
                    <StatusBadge status={download.status} />
                  </div>
                  <div className="mt-2">
                    <ProgressBar progress={download.progress} color={download.status === 'COMPLETED' ? 'green' : 'blue'} />
                  </div>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatBytes(download.downloadedBytes)} / {formatBytes(download.sizeBytes)}</span>
                    {download.status === 'DOWNLOADING' && <span>ETA: {formatEta(download.eta)}</span>}
                  </div>
                  {download.errorMessage && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{download.errorMessage}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {download.status === 'DOWNLOADING' && (
                    <button onClick={() => handlePause(download.id)} className="btn btn-secondary text-sm">Pause</button>
                  )}
                  {download.status === 'PAUSED' && (
                    <button onClick={() => handleResume(download.id)} className="btn btn-primary text-sm">Resume</button>
                  )}
                  {!['COMPLETED', 'CANCELED', 'FAILED'].includes(download.status) && (
                    <button onClick={() => handleCancel(download.id)} className="btn btn-danger text-sm">Cancel</button>
                  )}
                  {download.status === 'COMPLETED' && (
                    <a
                      href={`/api/downloads/${encodeURIComponent(download.id)}/info`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary text-sm"
                    >
                      Info
                    </a>
                  )}
                  {['COMPLETED', 'CANCELED', 'FAILED'].includes(download.status) && (
                    <button onClick={() => handleDelete(download.id)} className="btn btn-danger text-sm">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
