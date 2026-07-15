import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapCareerClubRow(row) {
  return {
    id: row.id,
    externalSource: row.external_source,
    externalId: row.external_id,
    name: row.name,
    nameNormalized: row.name_normalized,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertCareerClub(club) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = club.id ?? randomUUID();
  db.prepare(`
    INSERT INTO career_clubs (
      id, external_source, external_id, name, name_normalized, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_source, external_id) DO UPDATE SET
      name = excluded.name,
      name_normalized = excluded.name_normalized,
      updated_at = excluded.updated_at
  `).run(
    id,
    club.externalSource,
    club.externalId,
    club.name,
    club.nameNormalized,
    club.createdAt ?? now,
    club.updatedAt ?? now,
  );
  return findCareerClubByExternal(club.externalSource, club.externalId);
}

export function findCareerClubById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM career_clubs WHERE id = ?').get(id);
  return row ? mapCareerClubRow(row) : null;
}

export function findCareerClubByExternal(source, externalId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM career_clubs
    WHERE external_source = ? AND external_id = ?
  `).get(source, String(externalId));
  return row ? mapCareerClubRow(row) : null;
}
