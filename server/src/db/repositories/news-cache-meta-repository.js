import { getDb } from '../connection.js';

export function upsertNewsCacheMeta({ sourceId, lastFetchAt = null, lastError = null, status }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO news_cache_meta (source_id, last_fetch_at, last_error, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET
      last_fetch_at = excluded.last_fetch_at,
      last_error = excluded.last_error,
      status = excluded.status
  `).run(sourceId, lastFetchAt, lastError, status);
}

export function getAllNewsCacheMeta() {
  const db = getDb();
  return db.prepare('SELECT * FROM news_cache_meta ORDER BY source_id').all();
}

export function getAggregateNewsStatus() {
  const rows = getAllNewsCacheMeta();
  if (rows.length === 0) {
    return { status: 'ok', lastNewsFetchAt: null };
  }

  const statuses = rows.map((row) => row.status);
  let aggregateStatus = 'ok';
  if (statuses.every((s) => s === 'down')) {
    aggregateStatus = 'down';
  } else if (statuses.some((s) => s === 'down' || s === 'degraded')) {
    aggregateStatus = 'degraded';
  }

  const lastNewsFetchAt = rows
    .map((row) => row.last_fetch_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return { status: aggregateStatus, lastNewsFetchAt };
}

export function buildSourceWarnings() {
  const rows = getAllNewsCacheMeta();
  const warnings = [];

  const downCount = rows.filter((row) => row.status === 'down').length;
  const degradedCount = rows.filter((row) => row.status === 'degraded').length;

  if (downCount > 0 || degradedCount > 0) {
    warnings.push('部分新闻源暂不可用');
  }

  if (aggregateIsStale(rows)) {
    warnings.push('内容可能不是最新');
  }

  return warnings;
}

function aggregateIsStale(rows) {
  if (rows.length === 0) return false;
  const latest = rows
    .map((row) => row.last_fetch_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!latest) return true;
  const ageMs = Date.now() - new Date(latest).getTime();
  return ageMs > 30 * 60 * 1000;
}
