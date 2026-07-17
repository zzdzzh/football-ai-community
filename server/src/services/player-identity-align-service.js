import { getDb } from '../db/connection.js';
import * as linkRepo from '../db/repositories/player-identity-link-repository.js';
import { createConflict } from '../db/repositories/player-identity-conflict-repository.js';

/**
 * 规范化 Transfermarkt 对齐键：trim；拒绝空串与字面量 null。
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeTransfermarktKey(raw) {
  if (raw == null) return null;
  const key = String(raw).trim();
  if (!key) return null;
  if (key.toLowerCase() === 'null') return null;
  return key;
}

function defaultListStatsPlayersWithTm(options = {}) {
  const db = getDb();
  if (options.statsPlayerId) {
    const row = db.prepare(`
      SELECT id, name, transfermarkt_id
      FROM players
      WHERE id = ?
    `).get(options.statsPlayerId);
    return row ? [row] : [];
  }
  return db.prepare(`
    SELECT id, name, transfermarkt_id
    FROM players
    WHERE transfermarkt_id IS NOT NULL AND TRIM(transfermarkt_id) != ''
  `).all();
}

function defaultListCareerCandidatesByTm(matchKey) {
  const db = getDb();
  return db.prepare(`
    SELECT id, external_id, sync_status, name
    FROM career_players
    WHERE external_source = 'transfermarkt' AND external_id = ?
  `).all(matchKey);
}

function defaultListStatsCandidatesByTm(matchKey) {
  const db = getDb();
  return db.prepare(`
    SELECT id, transfermarkt_id, name
    FROM players
    WHERE transfermarkt_id = ?
  `).all(matchKey);
}

function defaultFindCareerById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM career_players WHERE id = ?').get(id) ?? null;
}

/**
 * @param {object} [deps]
 */
export function createPlayerIdentityAlignService(deps = {}) {
  const listStatsPlayersWithTm = deps.listStatsPlayersWithTm ?? defaultListStatsPlayersWithTm;
  const listCareerCandidatesByTm = deps.listCareerCandidatesByTm ?? defaultListCareerCandidatesByTm;
  const listStatsCandidatesByTm = deps.listStatsCandidatesByTm ?? defaultListStatsCandidatesByTm;
  const findCareerById = deps.findCareerById ?? defaultFindCareerById;
  const createActiveLinkFn = deps.createActiveLink ?? linkRepo.createActiveLink;
  const findLinkByPairFn = deps.findLinkByPair ?? linkRepo.findLinkByPair;
  const insertAlignRunFn = deps.insertAlignRun ?? linkRepo.insertAlignRun;
  const finishAlignRunFn = deps.finishAlignRun ?? linkRepo.finishAlignRun;
  const shelveActiveLinksByMatchKeyFn = deps.shelveActiveLinksByMatchKey ?? linkRepo.shelveActiveLinksByMatchKey;
  const createConflictFn = deps.createConflict ?? createConflict;

  function recordConflict({ matchKey, side, candidateStatsIds, candidateCareerIds, detail }) {
    createConflictFn({
      matchBasis: 'transfermarkt_id',
      matchKey,
      side,
      candidateStatsIds,
      candidateCareerIds,
      detail,
    });
    shelveActiveLinksByMatchKeyFn(matchKey);
  }

  function align(options) {
    const opts = options ?? {};
    const trigger = opts.trigger ?? 'api';
    const run = insertAlignRunFn({ trigger });
    let created = 0;
    let conflict = 0;
    let skipped = 0;
    const noteParts = [];

    const statsRows = listStatsPlayersWithTm(
      opts.statsPlayerId != null ? { statsPlayerId: opts.statsPlayerId } : undefined,
    );

    /** @type {Map<string, object[]>} */
    const byKey = new Map();

    for (const row of statsRows) {
      const matchKey = normalizeTransfermarktKey(row.transfermarkt_id);
      if (!matchKey) {
        skipped += 1;
        continue;
      }
      if (!byKey.has(matchKey)) byKey.set(matchKey, []);
      byKey.get(matchKey).push(row);
    }

    if (opts.careerPlayerId) {
      const career = findCareerById(opts.careerPlayerId);
      if (!career) {
        skipped += 1;
        noteParts.push('career_not_found');
      } else {
        const matchKey = normalizeTransfermarktKey(career.external_id);
        if (!matchKey || career.external_source !== 'transfermarkt') {
          skipped += 1;
          noteParts.push('career_missing_tm');
        } else if (!byKey.has(matchKey)) {
          const statsForKey = listStatsCandidatesByTm(matchKey);
          byKey.set(matchKey, statsForKey);
        }
      }
    }

    for (const [matchKey] of byKey.entries()) {
      const statsCandidates = listStatsCandidatesByTm(matchKey);

      if (opts.statsPlayerId && !statsCandidates.some((s) => s.id === opts.statsPlayerId)) {
        skipped += 1;
        continue;
      }

      if (opts.careerPlayerId) {
        const careerHit = listCareerCandidatesByTm(matchKey)
          .some((c) => c.id === opts.careerPlayerId);
        if (!careerHit) {
          skipped += 1;
          continue;
        }
      }

      if (statsCandidates.length > 1) {
        const careers = listCareerCandidatesByTm(matchKey);
        recordConflict({
          matchKey,
          side: 'stats',
          candidateStatsIds: statsCandidates.map((s) => s.id),
          candidateCareerIds: careers.map((c) => c.id),
          detail: `stats侧同一 TM ID 对应 ${statsCandidates.length} 名球员`,
        });
        conflict += 1;
        continue;
      }

      if (statsCandidates.length === 0) {
        skipped += 1;
        continue;
      }

      const statsPlayer = statsCandidates[0];
      const careerCandidates = listCareerCandidatesByTm(matchKey);

      if (careerCandidates.length > 1) {
        recordConflict({
          matchKey,
          side: 'career',
          candidateStatsIds: [statsPlayer.id],
          candidateCareerIds: careerCandidates.map((c) => c.id),
          detail: `career侧同一 TM ID 对应 ${careerCandidates.length} 名球员`,
        });
        conflict += 1;
        continue;
      }

      if (careerCandidates.length === 0) {
        skipped += 1;
        noteParts.push(`no_career:${matchKey}`);
        continue;
      }

      const career = careerCandidates[0];
      if (career.sync_status === 'failed') {
        skipped += 1;
        noteParts.push(`career_failed:${career.id}`);
        continue;
      }

      const existing = findLinkByPairFn(statsPlayer.id, career.id);
      if (existing?.status === 'active' && existing.confidence === 'high' && existing.matchKey === matchKey) {
        skipped += 1;
        continue;
      }

      try {
        createActiveLinkFn({
          statsPlayerId: statsPlayer.id,
          careerPlayerId: career.id,
          matchBasis: 'transfermarkt_id',
          matchKey,
          confidence: 'high',
        });
        created += 1;
      } catch (err) {
        recordConflict({
          matchKey,
          side: 'both',
          candidateStatsIds: [statsPlayer.id],
          candidateCareerIds: [career.id],
          detail: err.message,
        });
        conflict += 1;
      }
    }

    const notes = noteParts.length > 0
      ? [...new Set(noteParts)].slice(0, 20).join(';')
      : null;

    const finished = finishAlignRunFn(run.id, {
      createdCount: created,
      conflictCount: conflict,
      skippedCount: skipped,
      notes,
    });

    console.log(JSON.stringify({
      level: 'info',
      type: 'player_identity_align_finished',
      runId: finished.id,
      trigger,
      player_identity_align_created_total: finished.createdCount,
      player_identity_align_conflict_total: finished.conflictCount,
      player_identity_align_skipped_total: finished.skippedCount,
      finishedAt: finished.finishedAt,
      notes: finished.notes,
    }));

    return {
      runId: finished.id,
      created: finished.createdCount,
      conflict: finished.conflictCount,
      skipped: finished.skippedCount,
      finishedAt: finished.finishedAt,
      notes: finished.notes,
    };
  }

  return {
    align,
    normalizeTransfermarktKey,
  };
}

export function alignPlayerIdentities(options) {
  return createPlayerIdentityAlignService().align(options ?? {});
}

export const playerIdentityAlignService = createPlayerIdentityAlignService();
