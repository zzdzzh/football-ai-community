import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

function parseJsonArray(value) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function mapMessageRow(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metrics: parseJsonArray(row.metrics_json),
    confidence: row.confidence ?? undefined,
    missingFields: parseJsonArray(row.missing_fields_json),
    createdAt: row.created_at,
  };
}

export function createMessage(message) {
  const db = getDb();
  const id = message.id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, role, content, metrics_json, confidence, missing_fields_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    message.conversationId,
    message.role,
    message.content,
    message.metrics ? JSON.stringify(message.metrics) : null,
    message.confidence ?? null,
    message.missingFields ? JSON.stringify(message.missingFields) : null,
    message.createdAt ?? now,
  );
  return findMessageById(id);
}

export function findMessageById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  return row ? mapMessageRow(row) : null;
}

export function listMessagesByConversationId(conversationId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(conversationId);
  return rows.map(mapMessageRow);
}
