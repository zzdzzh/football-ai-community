import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

function parseJsonField(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function orderPlayerPair(playerIdA, playerIdB) {
  return playerIdA < playerIdB
    ? [playerIdA, playerIdB]
    : [playerIdB, playerIdA];
}

export function mapPlayerPairAnalysisRow(row) {
  return {
    id: row.id,
    playerIdLow: row.player_id_low,
    playerIdHigh: row.player_id_high,
    result: parseJsonField(row.result_json),
    dataFreshness: parseJsonField(row.data_freshness_json),
    maxHops: row.max_hops,
    computedAt: row.computed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertPlayerPairAnalysis(analysis) {
  const db = getDb();
  const now = new Date().toISOString();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(
    analysis.playerIdLow,
    analysis.playerIdHigh,
  );
  const id = analysis.id ?? randomUUID();
  const resultJson = JSON.stringify(analysis.result ?? {});
  const dataFreshnessJson = JSON.stringify(analysis.dataFreshness ?? {});

  db.prepare(`
    INSERT INTO player_pair_analyses (
      id, player_id_low, player_id_high, result_json, data_freshness_json,
      max_hops, computed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id_low, player_id_high) DO UPDATE SET
      result_json = excluded.result_json,
      data_freshness_json = excluded.data_freshness_json,
      max_hops = excluded.max_hops,
      computed_at = excluded.computed_at,
      updated_at = excluded.updated_at
  `).run(
    id,
    playerIdLow,
    playerIdHigh,
    resultJson,
    dataFreshnessJson,
    analysis.maxHops,
    analysis.computedAt ?? now,
    analysis.createdAt ?? now,
    analysis.updatedAt ?? now,
  );
  return findPlayerPairAnalysis(playerIdLow, playerIdHigh);
}

export function findPlayerPairAnalysis(playerIdA, playerIdB) {
  const db = getDb();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(playerIdA, playerIdB);
  const row = db.prepare(`
    SELECT * FROM player_pair_analyses
    WHERE player_id_low = ? AND player_id_high = ?
  `).get(playerIdLow, playerIdHigh);
  return row ? mapPlayerPairAnalysisRow(row) : null;
}

export function deletePlayerPairAnalysis(playerIdA, playerIdB) {
  const db = getDb();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(playerIdA, playerIdB);
  return db.prepare(`
    DELETE FROM player_pair_analyses
    WHERE player_id_low = ? AND player_id_high = ?
  `).run(playerIdLow, playerIdHigh).changes;
}
