import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapPlayerIdentityLinkRow(row) {
  return {
    id: row.id,
    statsPlayerId: row.stats_player_id,
    careerPlayerId: row.career_player_id,
    matchBasis: row.match_basis,
    matchKey: row.match_key,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlayerIdentityAlignRunRow(row) {
  return {
    id: row.id,
    trigger: row.trigger,
    createdCount: row.created_count,
    conflictCount: row.conflict_count,
    skippedCount: row.skipped_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    notes: row.notes ?? null,
  };
}

export function findLinkById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM player_identity_links WHERE id = ?').get(id);
  return row ? mapPlayerIdentityLinkRow(row) : null;
}

export function findActiveLinkByStatsPlayerId(statsPlayerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM player_identity_links
    WHERE stats_player_id = ? AND status = 'active'
    LIMIT 1
  `).get(statsPlayerId);
  return row ? mapPlayerIdentityLinkRow(row) : null;
}

export function findActiveLinkByCareerPlayerId(careerPlayerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM player_identity_links
    WHERE career_player_id = ? AND status = 'active'
    LIMIT 1
  `).get(careerPlayerId);
  return row ? mapPlayerIdentityLinkRow(row) : null;
}

export function findLinkByPair(statsPlayerId, careerPlayerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM player_identity_links
    WHERE stats_player_id = ? AND career_player_id = ?
  `).get(statsPlayerId, careerPlayerId);
  return row ? mapPlayerIdentityLinkRow(row) : null;
}

export function findActiveLinksByCareerPlayerIds(careerPlayerIds) {
  const ids = [...new Set((careerPlayerIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT * FROM player_identity_links
    WHERE status = 'active' AND career_player_id IN (${placeholders})
  `).all(...ids);
  return rows.map(mapPlayerIdentityLinkRow);
}

export function findLinksByMatchKey(matchKey) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM player_identity_links WHERE match_key = ?
  `).all(matchKey);
  return rows.map(mapPlayerIdentityLinkRow);
}

/**
 * 应用层强制：同一 stats / career 侧至多一条 active。
 * 若任一侧已有不同 pair 的 active，返回已有链接；否则可创建。
 */
export function findActiveUniquenessConflict({ statsPlayerId, careerPlayerId }) {
  const byStats = findActiveLinkByStatsPlayerId(statsPlayerId);
  if (byStats && byStats.careerPlayerId !== careerPlayerId) {
    return { side: 'stats', existing: byStats };
  }
  const byCareer = findActiveLinkByCareerPlayerId(careerPlayerId);
  if (byCareer && byCareer.statsPlayerId !== statsPlayerId) {
    return { side: 'career', existing: byCareer };
  }
  return null;
}

export function createActiveLink({
  statsPlayerId,
  careerPlayerId,
  matchBasis = 'transfermarkt_id',
  matchKey,
  confidence = 'high',
  id,
}) {
  if (!matchKey) {
    throw new Error('match_key is required for active link');
  }
  const conflict = findActiveUniquenessConflict({ statsPlayerId, careerPlayerId });
  if (conflict) {
    throw new Error(`active uniqueness conflict on ${conflict.side}`);
  }

  const existing = findLinkByPair(statsPlayerId, careerPlayerId);
  if (existing) {
    if (existing.status === 'active') return existing;
    return updateLinkStatus(existing.id, {
      status: 'active',
      confidence,
      matchBasis,
      matchKey,
    });
  }

  const db = getDb();
  const linkId = id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO player_identity_links (
      id, stats_player_id, career_player_id, match_basis, match_key,
      confidence, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(
    linkId,
    statsPlayerId,
    careerPlayerId,
    matchBasis,
    matchKey,
    confidence,
    now,
    now,
  );
  return findLinkById(linkId);
}

export function updateLinkStatus(id, {
  status,
  confidence,
  matchBasis,
  matchKey,
} = {}) {
  const db = getDb();
  const current = findLinkById(id);
  if (!current) return null;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE player_identity_links
    SET status = ?,
        confidence = ?,
        match_basis = ?,
        match_key = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    status ?? current.status,
    confidence ?? current.confidence,
    matchBasis ?? current.matchBasis,
    matchKey ?? current.matchKey,
    now,
    id,
  );
  return findLinkById(id);
}

export function shelveActiveLinksByMatchKey(matchKey) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE player_identity_links
    SET status = 'conflict_shelved', updated_at = ?
    WHERE match_key = ? AND status = 'active'
  `).run(now, matchKey).changes;
}

export function insertAlignRun({ trigger, notes, id } = {}) {
  const db = getDb();
  const runId = id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO player_identity_align_runs (
      id, trigger, created_count, conflict_count, skipped_count,
      started_at, finished_at, notes
    ) VALUES (?, ?, 0, 0, 0, ?, NULL, ?)
  `).run(runId, trigger, now, notes ?? null);
  return findAlignRunById(runId);
}

export function finishAlignRun(id, {
  createdCount = 0,
  conflictCount = 0,
  skippedCount = 0,
  notes,
} = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  const current = findAlignRunById(id);
  if (!current) return null;
  db.prepare(`
    UPDATE player_identity_align_runs
    SET created_count = ?,
        conflict_count = ?,
        skipped_count = ?,
        finished_at = ?,
        notes = ?
    WHERE id = ?
  `).run(
    createdCount,
    conflictCount,
    skippedCount,
    now,
    notes !== undefined ? notes : current.notes,
    id,
  );
  return findAlignRunById(id);
}

export function findAlignRunById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM player_identity_align_runs WHERE id = ?').get(id);
  return row ? mapPlayerIdentityAlignRunRow(row) : null;
}
