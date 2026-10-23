'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminDownload, AdminOverview, User } from '@movie-server/shared';
import {
  deleteAdminDownload,
  deleteAdminUser,
  getAdminOverview,
  updateSignupEnabled,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number | null): string {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingDownloadId, setDeletingDownloadId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.username !== 'admin') {
      router.replace('/');
    }
  }, [router, user]);

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      if (!user || user.username !== 'admin') {
        return;
      }

      try {
        const nextOverview = await getAdminOverview();
        if (mounted) {
          setOverview(nextOverview);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load admin page');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleToggleSignup = async () => {
    if (!overview) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const settings = await updateSignupEnabled(!overview.settings.signupEnabled);
      setOverview((current) => current ? { ...current, settings } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update signup setting');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (!confirm(`Delete user "${targetUser.username}" and all of their data?`)) {
      return;
    }

    setDeletingUserId(targetUser.id);
    setError('');

    try {
      await deleteAdminUser(targetUser.id);
      setOverview((current) => current
        ? {
            ...current,
            users: current.users.filter((item) => item.id !== targetUser.id),
            downloads: current.downloads.filter((item) => item.userId !== targetUser.id),
          }
        : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteDownload = async (download: AdminDownload) => {
    if (!confirm(`Delete "${download.name}" and its files?`)) {
      return;
    }

    setDeletingDownloadId(download.id);
    setError('');

    try {
      await deleteAdminDownload(download.id);
      setOverview((current) => current
        ? { ...current, downloads: current.downloads.filter((item) => item.id !== download.id) }
        : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete download');
    } finally {
      setDeletingDownloadId(null);
    }
  };

  if (user?.username !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          Admin
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage users and account creation.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-100 p-3 text-red-700 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {overview && (
        <>
          {(() => {
            const totalsByUser = new Map<string, { username: string; count: number; sizeBytes: number }>();

            for (const download of overview.downloads) {
              const current = totalsByUser.get(download.userId) ?? {
                username: download.username,
                count: 0,
                sizeBytes: 0,
              };

              current.count += 1;
              current.sizeBytes += download.sizeBytes ?? 0;
              totalsByUser.set(download.userId, current);
            }

            const totals = Array.from(totalsByUser.values())
              .sort((a, b) => b.sizeBytes - a.sizeBytes);

            return (
              <section className="card space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Download Storage
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {overview.downloads.length} downloads, {formatBytes(
                        overview.downloads.reduce((total, item) => total + (item.sizeBytes ?? 0), 0)
                      )} total
                    </p>
                  </div>
                </div>

                {totals.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No downloads yet.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {totals.map((item) => (
                      <div
                        key={item.username}
                        className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{item.username}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {item.count} downloads · {formatBytes(item.sizeBytes)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          <section className="card space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Signup
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {overview.settings.signupEnabled
                    ? 'New users can create accounts.'
                    : 'New account creation is disabled.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleSignup}
                disabled={saving}
                className={overview.settings.signupEnabled ? 'btn btn-danger' : 'btn btn-primary'}
              >
                {saving
                  ? 'Saving...'
                  : overview.settings.signupEnabled
                    ? 'Disable Signup'
                    : 'Enable Signup'}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Users
            </h2>
            {overview.users.map((item) => (
              <article key={item.id} className="card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {item.username}
                      </h3>
                      {item.username === 'admin' && (
                        <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Created: {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(item)}
                    disabled={item.username === 'admin' || deletingUserId === item.id}
                    className="btn btn-danger text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingUserId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Downloads
            </h2>
            {overview.downloads.length === 0 ? (
              <div className="card text-center py-8 text-gray-500 dark:text-gray-400">
                No downloads yet.
              </div>
            ) : (
              overview.downloads.map((download) => (
                <article key={download.id} className="card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-gray-900 dark:text-white">
                        {download.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{download.username}</span>
                        <span>{download.status}</span>
                        <span>{formatBytes(download.sizeBytes)}</span>
                        <span>{download.progress.toFixed(1)}%</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Created: {formatDate(download.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDownload(download)}
                      disabled={deletingDownloadId === download.id}
                      className="btn btn-danger text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingDownloadId === download.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
