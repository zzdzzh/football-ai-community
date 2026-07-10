import { getDb } from '../connection.js';

export function calcPlayerAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  return Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));
}

export function mapPlayerRow(row, teamName = null) {
  return {
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    teamName: teamName ?? row.team_name ?? undefined,
    position: row.position ?? undefined,
    age: calcPlayerAge(row.date_of_birth),
    nationality: row.nationality ?? undefined,
    leagueCode: row.league_code,
    dateOfBirth: row.date_of_birth ?? undefined,
    updatedAt: row.updated_at,
  };
}

export function upsertPlayer(player) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO players (
      id, name, team_id, position, date_of_birth, nationality, league_code, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      team_id = excluded.team_id,
      position = excluded.position,
      date_of_birth = excluded.date_of_birth,
      nationality = excluded.nationality,
      league_code = excluded.league_code,
      updated_at = excluded.updated_at
  `).run(
    player.id,
    player.name,
    player.teamId,
    player.position ?? null,
    player.dateOfBirth ?? null,
    player.nationality ?? null,
    player.leagueCode,
    player.updatedAt ?? now,
  );
  return findPlayerById(player.id);
}

export function findPlayerById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT p.*, t.name AS team_name
    FROM players p
    LEFT JOIN teams t ON t.id = p.team_id
    WHERE p.id = ?
  `).get(id);
  return row ? mapPlayerRow(row) : null;
}

export function searchPlayers({ league = null, teamId = null, position = null, q = null, page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const conditions = [];
  const params = [];

  if (league) {
    conditions.push('p.league_code = ?');
    params.push(league);
  }
  if (teamId) {
    conditions.push('p.team_id = ?');
    params.push(teamId);
  }
  if (position) {
    conditions.push('p.position LIKE ? COLLATE NOCASE');
    params.push(`%${position}%`);
  }
  if (q) {
    conditions.push('p.name LIKE ? COLLATE NOCASE');
    params.push(`%${q}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM players p ${whereClause}
  `).get(...params).count;

  const rows = db.prepare(`
    SELECT p.*, t.name AS team_name
    FROM players p
    LEFT JOIN teams t ON t.id = p.team_id
    ${whereClause}
    ORDER BY p.name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
  `).all(...params, safePageSize, offset);

  return {
    items: rows.map((row) => mapPlayerRow(row)),
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

export function countPlayersByLeague(leagueCode) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) AS count FROM players WHERE league_code = ?').get(leagueCode).count;
}

export function upsertPlayersInTransaction(players, handler = upsertPlayer) {
  const db = getDb();
  const tx = db.transaction((records) => {
    const result = [];
    for (const player of records) {
      result.push(handler(player));
    }
    return result;
  });
  return tx(players);
}
