import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

function toJsonArray(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') return value;
  return '[]';
}

function parseJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapPlayerIdentityConflictRow(row) {
  return {
    id: row.id,
    matchBasis: row.match_basis,
    matchKey: row.match_key,
    side: row.side,
    candidateStatsIds: parseJsonArray(row.candidate_stats_ids_json),
    candidateCareerIds: parseJsonArray(row.candidate_career_ids_json),
    detail: row.detail ?? null,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at ?? null,
  };
}

export function findConflictById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM player_identity_conflicts WHERE id = ?').get(id);
  return row ? mapPlayerIdentityConflictRow(row) : null;
}

export function findLatestConflictByMatchKey(matchKey) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM player_identity_conflicts
    WHERE match_key = ?
    ORDER BY detected_at DESC
    LIMIT 1
  `).get(matchKey);
  return row ? mapPlayerIdentityConflictRow(row) : null;
}

export function createConflict({
  matchBasis = 'transfermarkt_id',
  matchKey,
  side,
  candidateStatsIds = [],
  candidateCareerIds = [],
  detail,
  id,
}) {
  const db = getDb();
  const conflictId = id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO player_identity_conflicts (
      id, match_basis, match_key, side,
      candidate_stats_ids_json, candidate_career_ids_json,
      detail, detected_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    conflictId,
    matchBasis,
    matchKey,
    side,
    toJsonArray(candidateStatsIds),
    toJsonArray(candidateCareerIds),
    detail ?? null,
    now,
  );
  return findConflictById(conflictId);
}

export function markConflictResolved(id, resolvedAt) {
  const db = getDb();
  const now = resolvedAt ?? new Date().toISOString();
  db.prepare(`
    UPDATE player_identity_conflicts
    SET resolved_at = ?
    WHERE id = ?
  `).run(now, id);
  return findConflictById(id);
}
