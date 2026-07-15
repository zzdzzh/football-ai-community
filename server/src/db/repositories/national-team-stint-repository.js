import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapNationalTeamStintRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    nationKey: row.nation_key,
    nationName: row.nation_name,
    joinedRaw: row.joined_raw ?? undefined,
    leftRaw: row.left_raw ?? undefined,
    joinedOn: row.joined_on ?? undefined,
    leftOn: row.left_on ?? undefined,
    timePrecision: row.time_precision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertNationalTeamStint(stint) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = stint.id ?? randomUUID();
  db.prepare(`
    INSERT INTO national_team_stints (
      id, player_id, nation_key, nation_name, joined_raw, left_raw,
      joined_on, left_on, time_precision, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    stint.playerId,
    stint.nationKey,
    stint.nationName,
    stint.joinedRaw ?? null,
    stint.leftRaw ?? null,
    stint.joinedOn ?? null,
    stint.leftOn ?? null,
    stint.timePrecision,
    stint.createdAt ?? now,
    stint.updatedAt ?? now,
  );
  const row = db.prepare('SELECT * FROM national_team_stints WHERE id = ?').get(id);
  return row ? mapNationalTeamStintRow(row) : null;
}

export function listNationalTeamStintsByPlayerId(playerId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM national_team_stints
    WHERE player_id = ?
    ORDER BY joined_on ASC
  `).all(playerId);
  return rows.map((row) => mapNationalTeamStintRow(row));
}

export function deleteNationalTeamStintsByPlayerId(playerId) {
  const db = getDb();
  return db.prepare('DELETE FROM national_team_stints WHERE player_id = ?').run(playerId).changes;
}
