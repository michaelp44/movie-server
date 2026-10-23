import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import type { User } from '@movie-server/shared';
import { deleteLibraryFilesByDownloadId } from './library.service.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

const SALT_ROUNDS = 12;

function rowToUser(row: { id: string; username: string; created_at: string }): User {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
}

export async function createUser(username: string, password: string): Promise<User> {
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash)
    VALUES (?, ?, ?)
  `);
  
  stmt.run(id, username, passwordHash);
  
  return {
    id,
    username,
    createdAt: new Date().toISOString(),
  };
}

export function getUserByUsername(username: string): UserRow | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) as UserRow | undefined;
}

export function getUserById(id: string): User | undefined {
  const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
  const row = stmt.get(id) as { id: string; username: string; created_at: string } | undefined;
  
  if (!row) return undefined;
  return rowToUser(row);
}

export async function verifyPassword(username: string, password: string): Promise<User | null> {
  const user = getUserByUsername(username);
  if (!user) return null;
  
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;
  
  return {
    id: user.id,
    username: user.username,
    createdAt: user.created_at,
  };
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user) {
    return false;
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return false;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  return true;
}

export function listUsers(): User[] {
  const rows = db.prepare(`
    SELECT id, username, created_at
    FROM users
    ORDER BY username COLLATE NOCASE ASC
  `).all() as Array<{ id: string; username: string; created_at: string }>;

  return rows.map(rowToUser);
}

export function deleteUserById(id: string): User | undefined {
  const user = getUserById(id);
  if (!user) {
    return undefined;
  }

  const downloads = db.prepare('SELECT id FROM downloads WHERE user_id = ?')
    .all(id) as Array<{ id: string }>;

  for (const download of downloads) {
    deleteLibraryFilesByDownloadId(download.id);
  }

  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM dismissed_recommendations WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM wanted_downloads WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM downloads WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();

  return user;
}
