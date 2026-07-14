import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapPlayerStatsSnapshotRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    leagueCode: row.league_code,
    season: row.season,
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    penalties: row.penalties ?? 0,
    appearances: row.appearances ?? undefined,
    minutes: row.minutes ?? undefined,
    xg: row.xg ?? undefined,
    xa: row.xa ?? undefined,
    rating: row.rating ?? undefined,
    syncedAt: row.synced_at,
  };
}

export function upsertPlayerStatsSnapshot(snapshot) {
  const db = getDb();
  const id = snapshot.id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO player_stats_snapshots (
      id, player_id, league_code, season, goals, assists, penalties, appearances,
      minutes, xg, xa, rating, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, league_code, season) DO UPDATE SET
      goals = excluded.goals,
      assists = excluded.assists,
      penalties = excluded.penalties,
      appearances = COALESCE(excluded.appearances, player_stats_snapshots.appearances),
      minutes = COALESCE(excluded.minutes, player_stats_snapshots.minutes),
      xg = COALESCE(excluded.xg, player_stats_snapshots.xg),
      xa = COALESCE(excluded.xa, player_stats_snapshots.xa),
      rating = COALESCE(excluded.rating, player_stats_snapshots.rating),
      synced_at = excluded.synced_at
  `).run(
    id,
    snapshot.playerId,
    snapshot.leagueCode,
    snapshot.season,
    snapshot.goals ?? 0,
    snapshot.assists ?? 0,
    snapshot.penalties ?? 0,
    snapshot.appearances ?? null,
    snapshot.minutes ?? null,
    snapshot.xg ?? null,
    snapshot.xa ?? null,
    snapshot.rating ?? null,
    snapshot.syncedAt ?? now,
  );
  return findPlayerStatsSnapshot(snapshot.playerId, snapshot.leagueCode, snapshot.season);
}

export function findPlayerStatsSnapshot(playerId, leagueCode, season) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM player_stats_snapshots
    WHERE player_id = ? AND league_code = ? AND season = ?
  `).get(playerId, leagueCode, season);
  return row ? mapPlayerStatsSnapshotRow(row) : null;
}

export function listPlayerStatsSnapshots(playerId, { leagueCode = null, season = null } = {}) {
  const db = getDb();
  const conditions = ['player_id = ?'];
  const params = [playerId];

  if (leagueCode) {
    conditions.push('league_code = ?');
    params.push(leagueCode);
  }
  if (season) {
    conditions.push('season = ?');
    params.push(season);
  }

  const rows = db.prepare(`
    SELECT * FROM player_stats_snapshots
    WHERE ${conditions.join(' AND ')}
    ORDER BY season DESC, goals DESC
  `).all(...params);
  return rows.map(mapPlayerStatsSnapshotRow);
}

export function mapSnapshotToPlayerStats(snapshot) {
  const stats = [
    { name: '进球', value: snapshot.goals },
    { name: '助攻', value: snapshot.assists },
    { name: '点球', value: snapshot.penalties },
  ];
  if (snapshot.appearances != null) {
    stats.push({ name: '出场', value: snapshot.appearances });
  }
  if (snapshot.minutes != null) {
    stats.push({ name: '出场分钟', value: snapshot.minutes });
  }
  if (snapshot.xg != null) {
    stats.push({ name: 'xG', value: snapshot.xg });
  }
  if (snapshot.xa != null) {
    stats.push({ name: 'xA', value: snapshot.xa });
  }
  if (snapshot.rating != null) {
    stats.push({ name: '评分', value: snapshot.rating });
  }
  return stats;
}
