import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapConversationRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    contextType: row.context_type,
    contextId: row.context_id ?? null,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createConversation(conversation) {
  const db = getDb();
  const id = conversation.id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO conversations (
      id, user_id, agent_id, context_type, context_id, title, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    conversation.userId,
    conversation.agentId,
    conversation.contextType,
    conversation.contextId ?? null,
    conversation.title,
    conversation.createdAt ?? now,
    conversation.updatedAt ?? now,
  );
  return findConversationById(id);
}

export function findConversationById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  return row ? mapConversationRow(row) : null;
}

export function listConversationsByUser({ userId, agentId = 'stats', page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM conversations
    WHERE user_id = ? AND agent_id = ?
  `).get(userId, agentId).count;

  const rows = db.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ? AND agent_id = ?
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, agentId, safePageSize, offset);

  return {
    items: rows.map(mapConversationRow),
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

export function touchConversationUpdatedAt(id) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);
  return findConversationById(id);
}
