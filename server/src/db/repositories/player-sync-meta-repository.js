import { getDb } from '../connection.js';

export { ALLOWED_LEAGUES } from '../../constants/league-codes.js';

export function mapPlayerSyncMetaRow(row) {
  return {
    leagueCode: row.league_code,
    lastSyncAt: row.last_sync_at ?? null,
    lastError: row.last_error ?? null,
    status: row.status,
    playersCount: row.players_count ?? 0,
  };
}

export function upsertPlayerSyncMeta(meta) {
  const db = getDb();
  db.prepare(`
    INSERT INTO player_sync_meta (
      league_code, last_sync_at, last_error, status, players_count
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(league_code) DO UPDATE SET
      last_sync_at = excluded.last_sync_at,
      last_error = excluded.last_error,
      status = excluded.status,
      players_count = excluded.players_count
  `).run(
    meta.leagueCode,
    meta.lastSyncAt ?? null,
    meta.lastError ?? null,
    meta.status,
    meta.playersCount ?? 0,
  );
  return findPlayerSyncMetaByLeague(meta.leagueCode);
}

export function findPlayerSyncMetaByLeague(leagueCode) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM player_sync_meta WHERE league_code = ?').get(leagueCode);
  return row ? mapPlayerSyncMetaRow(row) : null;
}

export function getAllPlayerSyncMeta() {
  const db = getDb();
  return db.prepare('SELECT * FROM player_sync_meta ORDER BY league_code').all()
    .map(mapPlayerSyncMetaRow);
}

export function getAggregatePlayerSyncStatus() {
  const rows = getAllPlayerSyncMeta();
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
    warnings.push('部分联赛球员数据同步暂不可用');
  }

  return { status, warnings };
}
