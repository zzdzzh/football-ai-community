import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

function parseKeyPoints(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapFeedItemRow(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentDisplayName: row.agent_display_name,
    type: row.type,
    title: row.title,
    summary: row.summary ?? undefined,
    publishedAt: row.published_at,
    sourceUrl: row.source_url ?? undefined,
    sourceName: row.source_name ?? undefined,
    keyPoints: parseKeyPoints(row.key_points),
    eventKey: row.event_key ?? undefined,
    relatedTo: row.related_to ?? undefined,
  };
}

export function createFeedItem(item) {
  const db = getDb();
  const id = item.id ?? randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO feed_items (
      id, agent_id, type, title, summary, source_url, source_name,
      key_points, event_key, related_to, visibility, published_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    item.agentId,
    item.type,
    item.title,
    item.summary ?? null,
    item.sourceUrl ?? null,
    item.sourceName ?? null,
    item.keyPoints ? JSON.stringify(item.keyPoints) : null,
    item.eventKey ?? null,
    item.relatedTo ?? null,
    item.visibility ?? 'public',
    item.publishedAt ?? now,
    now,
  );

  return findFeedItemById(id);
}

export function findFeedItemById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT fi.*, ap.display_name AS agent_display_name
    FROM feed_items fi
    JOIN agent_profiles ap ON ap.id = fi.agent_id
    WHERE fi.id = ?
  `).get(id);
  return row ? mapFeedItemRow(row) : null;
}

export function findFeedItemBySourceUrl(sourceUrl) {
  const db = getDb();
  return db.prepare('SELECT * FROM feed_items WHERE source_url = ?').get(sourceUrl) ?? null;
}

export function findRecentFeedItemsForDedup({ hours = 48 } = {}) {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return db.prepare(`
    SELECT id, title, source_url, event_key
    FROM feed_items
    WHERE agent_id = 'news' AND published_at >= ?
  `).all(since);
}

export function listFeedItems({ page = 1, pageSize = 20, agentId = null } = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const conditions = ["fi.visibility = 'public'"];
  const params = [];

  if (agentId) {
    conditions.push('fi.agent_id = ?');
    params.push(agentId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM feed_items fi
    ${whereClause}
  `).get(...params).count;

  const rows = db.prepare(`
    SELECT fi.*, ap.display_name AS agent_display_name
    FROM feed_items fi
    JOIN agent_profiles ap ON ap.id = fi.agent_id
    ${whereClause}
    ORDER BY fi.published_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, safePageSize, offset);

  return {
    items: rows.map(mapFeedItemRow),
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

export function findRelatedFeedItems(parentId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT fi.*, ap.display_name AS agent_display_name
    FROM feed_items fi
    JOIN agent_profiles ap ON ap.id = fi.agent_id
    WHERE fi.related_to = ?
    ORDER BY fi.published_at DESC
  `).all(parentId);
  return rows.map(mapFeedItemRow);
}

export function insertFeedItemsInTransaction(items, handler) {
  const db = getDb();
  const tx = db.transaction((records) => {
    const created = [];
    for (const item of records) {
      created.push(handler(item) ?? createFeedItem(item));
    }
    return created;
  });
  return tx(items);
}
