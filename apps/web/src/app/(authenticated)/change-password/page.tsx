'use client';

import { FormEvent, useState } from 'react';
import { changePassword } from '@/lib/api';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setSaving(true);

    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          Change Password
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Update the password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-200">
            {success}
          </div>
        )}

        <div>
          <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="input"
            required
            minLength={8}
            autoComplete="current-password"
          />
        </div>

        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary w-full">
          {saving ? 'Saving...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
