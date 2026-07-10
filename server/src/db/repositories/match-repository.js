import { getDb } from '../connection.js';
import { mapTeamRow } from './team-repository.js';

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function mapMatchRow(row, { homeTeam = null, awayTeam = null } = {}) {
  return {
    id: row.id,
    leagueCode: row.league_code,
    season: row.season ?? undefined,
    matchday: row.matchday ?? undefined,
    utcDate: row.utc_date,
    status: row.status,
    homeTeam: homeTeam ?? (row.home_team_id ? { id: row.home_team_id } : undefined),
    awayTeam: awayTeam ?? (row.away_team_id ? { id: row.away_team_id } : undefined),
    homeScore: row.home_score ?? null,
    awayScore: row.away_score ?? null,
    stats: parseJson(row.stats_json) ?? undefined,
    events: parseJson(row.events_json) ?? undefined,
    dataCompleteness: row.data_completeness,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attachTeams(row) {
  const db = getDb();
  const homeRow = db.prepare('SELECT * FROM teams WHERE id = ?').get(row.home_team_id);
  const awayRow = db.prepare('SELECT * FROM teams WHERE id = ?').get(row.away_team_id);
  return mapMatchRow(row, {
    homeTeam: homeRow ? mapTeamRow(homeRow) : { id: row.home_team_id },
    awayTeam: awayRow ? mapTeamRow(awayRow) : { id: row.away_team_id },
  });
}

export function upsertMatch(match) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO matches (
      id, league_code, season, matchday, utc_date, status,
      home_team_id, away_team_id, home_score, away_score,
      stats_json, events_json, data_completeness, last_synced_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      league_code = excluded.league_code,
      season = excluded.season,
      matchday = excluded.matchday,
      utc_date = excluded.utc_date,
      status = excluded.status,
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      stats_json = excluded.stats_json,
      events_json = excluded.events_json,
      data_completeness = excluded.data_completeness,
      last_synced_at = excluded.last_synced_at,
      updated_at = excluded.updated_at
  `).run(
    match.id,
    match.leagueCode,
    match.season ?? null,
    match.matchday ?? null,
    match.utcDate,
    match.status,
    match.homeTeamId,
    match.awayTeamId,
    match.homeScore ?? null,
    match.awayScore ?? null,
    match.statsJson ? JSON.stringify(match.statsJson) : null,
    match.eventsJson ? JSON.stringify(match.eventsJson) : null,
    match.dataCompleteness ?? 'pending',
    match.lastSyncedAt ?? now,
    match.createdAt ?? now,
    match.updatedAt ?? now,
  );
  return findMatchById(match.id);
}

export function findMatchById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
  return row ? attachTeams(row) : null;
}

export function listMatches({
  league = null,
  status = null,
  teamId = null,
  dateFrom = null,
  dateTo = null,
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const conditions = [];
  const params = [];

  if (league) {
    conditions.push('m.league_code = ?');
    params.push(league);
  }
  if (status) {
    conditions.push('m.status = ?');
    params.push(status);
  }
  if (teamId) {
    conditions.push('(m.home_team_id = ? OR m.away_team_id = ?)');
    params.push(teamId, teamId);
  }
  if (dateFrom) {
    conditions.push('date(m.utc_date) >= date(?)');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('date(m.utc_date) <= date(?)');
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM matches m ${whereClause}
  `).get(...params).count;

  const rows = db.prepare(`
    SELECT m.*
    FROM matches m
    ${whereClause}
    ORDER BY m.utc_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, safePageSize, offset);

  return {
    items: rows.map((row) => attachTeams(row)),
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

export function listRecentMatchesByTeamId(teamId, limit = 5) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT m.*
    FROM matches m
    WHERE m.home_team_id = ? OR m.away_team_id = ?
    ORDER BY m.utc_date DESC
    LIMIT ?
  `).all(teamId, teamId, limit);
  return rows.map((row) => attachTeams(row));
}

export function hasLiveMatches() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM matches WHERE status = 'LIVE'").get();
  return row.count > 0;
}

export function upsertMatchesInTransaction(matches, handler = upsertMatch) {
  const db = getDb();
  const tx = db.transaction((records) => {
    const result = [];
    for (const match of records) {
      result.push(handler(match));
    }
    return result;
  });
  return tx(matches);
}

export function findFinishedMatchesMissingStats(limit = 10) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM matches
    WHERE status = 'FINISHED' AND (stats_json IS NULL OR stats_json = '')
    ORDER BY utc_date DESC
    LIMIT ?
  `).all(limit);
  return rows.map((row) => attachTeams(row));
}
