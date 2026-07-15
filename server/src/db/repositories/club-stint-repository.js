import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapClubStintRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    clubId: row.club_id,
    joinedRaw: row.joined_raw ?? undefined,
    leftRaw: row.left_raw ?? undefined,
    joinedOn: row.joined_on ?? undefined,
    leftOn: row.left_on ?? undefined,
    timePrecision: row.time_precision,
    transferType: row.transfer_type ?? undefined,
    transferFee: row.transfer_fee ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertClubStint(stint) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = stint.id ?? randomUUID();
  db.prepare(`
    INSERT INTO club_stints (
      id, player_id, club_id, joined_raw, left_raw, joined_on, left_on,
      time_precision, transfer_type, transfer_fee, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    stint.playerId,
    stint.clubId,
    stint.joinedRaw ?? null,
    stint.leftRaw ?? null,
    stint.joinedOn ?? null,
    stint.leftOn ?? null,
    stint.timePrecision,
    stint.transferType ?? null,
    stint.transferFee ?? null,
    stint.sortOrder,
    stint.createdAt ?? now,
    stint.updatedAt ?? now,
  );
  const row = db.prepare('SELECT * FROM club_stints WHERE id = ?').get(id);
  return row ? mapClubStintRow(row) : null;
}

export function listClubStintsByPlayerId(playerId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM club_stints
    WHERE player_id = ?
    ORDER BY sort_order ASC
  `).all(playerId);
  return rows.map((row) => mapClubStintRow(row));
}

export function deleteClubStintsByPlayerId(playerId) {
  const db = getDb();
  return db.prepare('DELETE FROM club_stints WHERE player_id = ?').run(playerId).changes;
}

export function listClubStintsByClubId(clubId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM club_stints
    WHERE club_id = ?
    ORDER BY sort_order ASC
  `).all(clubId);
  return rows.map((row) => mapClubStintRow(row));
}

export function listClubStintsWithPlayer() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      cs.*,
      cp.name AS player_name,
      cc.name AS club_name
    FROM club_stints cs
    JOIN career_players cp ON cp.id = cs.player_id
    JOIN career_clubs cc ON cc.id = cs.club_id
    ORDER BY cs.player_id ASC, cs.sort_order ASC
  `).all();

  return rows.map((row) => ({
    ...mapClubStintRow(row),
    playerName: row.player_name,
    clubName: row.club_name,
  }));
}
