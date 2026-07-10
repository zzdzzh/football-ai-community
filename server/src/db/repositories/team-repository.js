import { getDb } from '../connection.js';

export function mapTeamRow(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name ?? undefined,
    tla: row.tla ?? undefined,
    crestUrl: row.crest_url ?? undefined,
    leagueCode: row.league_code,
    updatedAt: row.updated_at,
  };
}

export function upsertTeam(team) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO teams (id, name, short_name, tla, crest_url, league_code, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      short_name = excluded.short_name,
      tla = excluded.tla,
      crest_url = excluded.crest_url,
      league_code = excluded.league_code,
      updated_at = excluded.updated_at
  `).run(
    team.id,
    team.name,
    team.shortName ?? null,
    team.tla ?? null,
    team.crestUrl ?? null,
    team.leagueCode,
    team.updatedAt ?? now,
  );
  return findTeamById(team.id);
}

export function findTeamById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
  return row ? mapTeamRow(row) : null;
}

export function searchTeams({ q = null, league = null, page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const conditions = [];
  const params = [];

  if (league) {
    conditions.push('league_code = ?');
    params.push(league);
  }
  if (q) {
    conditions.push('name LIKE ? COLLATE NOCASE');
    params.push(`%${q}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS count FROM teams ${whereClause}`).get(...params).count;
  const rows = db.prepare(`
    SELECT * FROM teams ${whereClause}
    ORDER BY name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
  `).all(...params, safePageSize, offset);

  return {
    items: rows.map(mapTeamRow),
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

export function upsertTeamsInTransaction(teams, handler = upsertTeam) {
  const db = getDb();
  const tx = db.transaction((records) => {
    const result = [];
    for (const team of records) {
      result.push(handler(team));
    }
    return result;
  });
  return tx(teams);
}
