import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapCareerPlayerRow(row) {
  return {
    id: row.id,
    externalSource: row.external_source,
    externalId: row.external_id,
    name: row.name,
    nameNormalized: row.name_normalized,
    dateOfBirth: row.date_of_birth ?? undefined,
    nationality: row.nationality ?? undefined,
    position: row.position ?? undefined,
    currentClubId: row.current_club_id ?? undefined,
    currentClubName: row.current_club_name ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    syncStatus: row.sync_status,
    lastSyncError: row.last_sync_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertCareerPlayer(player) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = player.id ?? randomUUID();
  db.prepare(`
    INSERT INTO career_players (
      id, external_source, external_id, name, name_normalized,
      date_of_birth, nationality, position, current_club_id, current_club_name,
      synced_at, sync_status, last_sync_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_source, external_id) DO UPDATE SET
      name = excluded.name,
      name_normalized = excluded.name_normalized,
      date_of_birth = COALESCE(excluded.date_of_birth, career_players.date_of_birth),
      nationality = COALESCE(excluded.nationality, career_players.nationality),
      position = COALESCE(excluded.position, career_players.position),
      current_club_id = COALESCE(excluded.current_club_id, career_players.current_club_id),
      current_club_name = COALESCE(excluded.current_club_name, career_players.current_club_name),
      synced_at = COALESCE(excluded.synced_at, career_players.synced_at),
      sync_status = excluded.sync_status,
      last_sync_error = excluded.last_sync_error,
      updated_at = excluded.updated_at
  `).run(
    id,
    player.externalSource,
    player.externalId,
    player.name,
    player.nameNormalized,
    player.dateOfBirth ?? null,
    player.nationality ?? null,
    player.position ?? null,
    player.currentClubId ?? null,
    player.currentClubName ?? null,
    player.syncedAt ?? null,
    player.syncStatus,
    player.lastSyncError ?? null,
    player.createdAt ?? now,
    player.updatedAt ?? now,
  );
  return findCareerPlayerByExternal(player.externalSource, player.externalId);
}

export function findCareerPlayerById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM career_players WHERE id = ?').get(id);
  return row ? mapCareerPlayerRow(row) : null;
}

export function findCareerPlayerByExternal(source, externalId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM career_players
    WHERE external_source = ? AND external_id = ?
  `).get(source, String(externalId));
  return row ? mapCareerPlayerRow(row) : null;
}

export function searchCareerPlayers({ q, page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('name_normalized LIKE ?');
    params.push(`%${String(q).toLowerCase()}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM career_players ${whereClause}
  `).get(...params).count;

  const rows = db.prepare(`
    SELECT * FROM career_players
    ${whereClause}
    ORDER BY name_normalized ASC
    LIMIT ? OFFSET ?
  `).all(...params, safePageSize, offset);

  return {
    items: rows.map((row) => mapCareerPlayerRow(row)),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

export function updateCareerPlayerSyncStatus(id, {
  syncStatus,
  syncedAt,
  lastSyncError,
  currentClubId,
  currentClubName,
} = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  const sets = ['sync_status = ?', 'updated_at = ?'];
  const params = [syncStatus, now];

  if (syncedAt !== undefined) {
    sets.push('synced_at = ?');
    params.push(syncedAt);
  }
  if (lastSyncError !== undefined) {
    sets.push('last_sync_error = ?');
    params.push(lastSyncError);
  }
  if (currentClubId !== undefined) {
    sets.push('current_club_id = ?');
    params.push(currentClubId);
  }
  if (currentClubName !== undefined) {
    sets.push('current_club_name = ?');
    params.push(currentClubName);
  }

  params.push(id);
  db.prepare(`
    UPDATE career_players SET ${sets.join(', ')} WHERE id = ?
  `).run(...params);
  return findCareerPlayerById(id);
}
