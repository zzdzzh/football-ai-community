import { getDb } from '../connection.js';

export { ALLOWED_LEAGUES } from '../../constants/league-codes.js';

export function mapMatchSyncMetaRow(row) {
  return {
    leagueCode: row.league_code,
    lastSyncAt: row.last_sync_at ?? null,
    lastError: row.last_error ?? null,
    status: row.status,
    requestsInWindow: row.requests_in_window ?? 0,
    windowStartedAt: row.window_started_at ?? null,
  };
}

export function upsertMatchSyncMeta(meta) {
  const db = getDb();
  db.prepare(`
    INSERT INTO match_sync_meta (
      league_code, last_sync_at, last_error, status, requests_in_window, window_started_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(league_code) DO UPDATE SET
      last_sync_at = excluded.last_sync_at,
      last_error = excluded.last_error,
      status = excluded.status,
      requests_in_window = excluded.requests_in_window,
      window_started_at = excluded.window_started_at
  `).run(
    meta.leagueCode,
    meta.lastSyncAt ?? null,
    meta.lastError ?? null,
    meta.status,
    meta.requestsInWindow ?? 0,
    meta.windowStartedAt ?? null,
  );
  return findMatchSyncMetaByLeague(meta.leagueCode);
}

export function findMatchSyncMetaByLeague(leagueCode) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM match_sync_meta WHERE league_code = ?').get(leagueCode);
  return row ? mapMatchSyncMetaRow(row) : null;
}

export function getAllMatchSyncMeta() {
  const db = getDb();
  return db.prepare('SELECT * FROM match_sync_meta ORDER BY league_code').all()
    .map(mapMatchSyncMetaRow);
}

export function getAggregateMatchSyncStatus() {
  const rows = getAllMatchSyncMeta();
  if (rows.length === 0) {
    return { status: 'ok', warnings: [] };
  }

  const statuses = rows.map((row) => row.status);
  let status = 'ok';
  if (statuses.every((s) => s === 'down')) {
    status = 'down';
  } else if (statuses.some((s) => s === 'down' || s === 'degraded')) {
    status = 'degraded';
  }

  const warnings = [];
  const downCount = rows.filter((row) => row.status === 'down').length;
  const degradedCount = rows.filter((row) => row.status === 'degraded').length;
  if (downCount > 0 || degradedCount > 0) {
    warnings.push('部分联赛数据同步暂不可用');
  }

  return { status, warnings };
}

export function updateRateLimitWindow({ leagueCode, requestsInWindow, windowStartedAt }) {
  const db = getDb();
  db.prepare(`
    UPDATE match_sync_meta
    SET requests_in_window = ?, window_started_at = ?
    WHERE league_code = ?
  `).run(requestsInWindow, windowStartedAt, leagueCode);
}
