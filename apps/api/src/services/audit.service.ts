import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import type { AuditLogEntry } from '@movie-server/shared';

export type AuditAction =
  | 'SIGNUP'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'DOWNLOAD_REQUEST'
  | 'DOWNLOAD_CONFIRM'
  | 'DOWNLOAD_PAUSE'
  | 'DOWNLOAD_RESUME'
  | 'DOWNLOAD_CANCEL'
  | 'DOWNLOAD_DELETE'
  | 'WANTED_DOWNLOAD_CREATE'
  | 'WANTED_DOWNLOAD_CHECK'
  | 'WANTED_DOWNLOAD_CANCEL'
  | 'ADMIN_USER_DELETE'
  | 'ADMIN_SIGNUP_SETTING_UPDATE'
  | 'ADMIN_DOWNLOAD_DELETE'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD';

export function logAudit(
  userId: string,
  action: AuditAction,
  details: Record<string, unknown>,
  ipAddress: string
): void {
  const id = uuidv4();
  const detailsJson = JSON.stringify(details);
  
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, details, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, userId, action, detailsJson, ipAddress);
  
  logger.info({ userId, action, details, ipAddress }, 'Audit log entry created');
}

export function getAuditLogs(
  page: number = 1,
  pageSize: number = 50
): { items: AuditLogEntry[]; total: number } {
  const offset = (page - 1) * pageSize;
  
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM audit_logs');
  const { count } = countStmt.get() as { count: number };
  
  const stmt = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const rows = stmt.all(pageSize, offset) as Array<{
    id: string;
    user_id: string;
    action: string;
    details: string;
    ip_address: string;
    created_at: string;
  }>;
  
  const items: AuditLogEntry[] = rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    action: row.action,
    details: row.details,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  }));
  
  return { items, total: count };
}
