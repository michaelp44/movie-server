import { db } from '../db/index.js';

const SIGNUP_ENABLED_KEY = 'signup_enabled';

export function isSignupEnabled(): boolean {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(SIGNUP_ENABLED_KEY) as { value: string } | undefined;

  return row?.value !== 'false';
}

export function setSignupEnabled(enabled: boolean): boolean {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(SIGNUP_ENABLED_KEY, enabled ? 'true' : 'false');

  return enabled;
}
