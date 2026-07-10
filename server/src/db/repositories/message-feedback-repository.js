import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapMessageFeedbackRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    messageId: row.message_id,
    helpful: row.helpful === 1,
    createdAt: row.created_at,
  };
}

export function upsertMessageFeedback({ userId, messageId, helpful }) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare(`
    SELECT id FROM message_feedback WHERE user_id = ? AND message_id = ?
  `).get(userId, messageId);

  if (existing) {
    db.prepare(`
      UPDATE message_feedback SET helpful = ?, created_at = ? WHERE id = ?
    `).run(helpful ? 1 : 0, now, existing.id);
    return findMessageFeedbackById(existing.id);
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO message_feedback (id, user_id, message_id, helpful, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, messageId, helpful ? 1 : 0, now);
  return findMessageFeedbackById(id);
}

export function findMessageFeedbackById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM message_feedback WHERE id = ?').get(id);
  return row ? mapMessageFeedbackRow(row) : null;
}

export function findMessageFeedbackByUserAndMessage(userId, messageId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM message_feedback WHERE user_id = ? AND message_id = ?
  `).get(userId, messageId);
  return row ? mapMessageFeedbackRow(row) : null;
}
