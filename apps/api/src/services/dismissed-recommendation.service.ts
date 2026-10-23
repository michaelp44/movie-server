import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

export interface DismissRecommendationInput {
  itemId: string;
  title: string;
  source: string;
  reason: 'already_watched' | 'not_interested';
}

export function dismissRecommendation(userId: string, input: DismissRecommendationInput): void {
  const stmt = db.prepare(`
    INSERT INTO dismissed_recommendations (id, user_id, item_id, title, source, reason)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET
      title = excluded.title,
      source = excluded.source,
      reason = excluded.reason
  `);

  stmt.run(uuidv4(), userId, input.itemId, input.title, input.source, input.reason);
}

export function getDismissedRecommendationIds(userId: string): Set<string> {
  const stmt = db.prepare(`
    SELECT item_id FROM dismissed_recommendations
    WHERE user_id = ?
  `);
  const rows = stmt.all(userId) as Array<{ item_id: string }>;

  return new Set(rows.map((row) => row.item_id));
}
