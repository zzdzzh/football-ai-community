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

export function mapRelationshipNarrativeRow(row) {
  return {
    id: row.id,
    playerIdLow: row.player_id_low,
    playerIdHigh: row.player_id_high,
    analysisId: row.analysis_id,
    analysisComputedAt: row.analysis_computed_at,
    status: row.status,
    narrativeText: row.narrative_text ?? null,
    model: row.model ?? null,
    promptVersion: row.prompt_version ?? null,
    claims: parseJsonField(row.claims_json),
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 按球员对 + 结论版本查找叙事（含 ready / failed）。
 */
export function findByPairAndVersion(playerIdA, playerIdB, analysisId, analysisComputedAt) {
  const db = getDb();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(playerIdA, playerIdB);
  const row = db.prepare(`
    SELECT * FROM relationship_narratives
    WHERE player_id_low = ?
      AND player_id_high = ?
      AND analysis_id = ?
      AND analysis_computed_at = ?
  `).get(playerIdLow, playerIdHigh, analysisId, analysisComputedAt);
  return row ? mapRelationshipNarrativeRow(row) : null;
}

/**
 * 按分析 ID + computed_at 查找（版本键唯一）。
 */
export function findByAnalysisVersion(analysisId, analysisComputedAt) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM relationship_narratives
    WHERE analysis_id = ? AND analysis_computed_at = ?
  `).get(analysisId, analysisComputedAt);
  return row ? mapRelationshipNarrativeRow(row) : null;
}

/**
 * 查找球员对下最新一条 ready 叙事（不校验版本；调用方自行判 stale）。
 */
export function findLatestReadyByPair(playerIdA, playerIdB) {
  const db = getDb();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(playerIdA, playerIdB);
  const row = db.prepare(`
    SELECT * FROM relationship_narratives
    WHERE player_id_low = ? AND player_id_high = ? AND status = 'ready'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(playerIdLow, playerIdHigh);
  return row ? mapRelationshipNarrativeRow(row) : null;
}

/**
 * 写入或覆盖同版本 ready 叙事（force 重生成走此路径）。
 */
export function upsertReadyNarrative(narrative) {
  const db = getDb();
  const now = new Date().toISOString();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(
    narrative.playerIdLow ?? narrative.playerIdA,
    narrative.playerIdHigh ?? narrative.playerIdB,
  );
  const id = narrative.id ?? randomUUID();
  const claimsJson = narrative.claims == null
    ? null
    : JSON.stringify(narrative.claims);

  db.prepare(`
    INSERT INTO relationship_narratives (
      id, player_id_low, player_id_high, analysis_id, analysis_computed_at,
      status, narrative_text, model, prompt_version, claims_json,
      error_code, error_message, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    ON CONFLICT(analysis_id, analysis_computed_at) DO UPDATE SET
      player_id_low = excluded.player_id_low,
      player_id_high = excluded.player_id_high,
      status = 'ready',
      narrative_text = excluded.narrative_text,
      model = excluded.model,
      prompt_version = excluded.prompt_version,
      claims_json = excluded.claims_json,
      error_code = NULL,
      error_message = NULL,
      created_by_user_id = COALESCE(excluded.created_by_user_id, relationship_narratives.created_by_user_id),
      updated_at = excluded.updated_at
  `).run(
    id,
    playerIdLow,
    playerIdHigh,
    narrative.analysisId,
    narrative.analysisComputedAt,
    narrative.narrativeText,
    narrative.model ?? null,
    narrative.promptVersion ?? null,
    claimsJson,
    narrative.createdByUserId ?? null,
    narrative.createdAt ?? now,
    narrative.updatedAt ?? now,
  );

  return findByAnalysisVersion(narrative.analysisId, narrative.analysisComputedAt);
}

/**
 * 可选：落库失败行供排障（同版本覆盖为 failed，清空正文）。
 */
export function markFailedNarrative(narrative) {
  const db = getDb();
  const now = new Date().toISOString();
  const [playerIdLow, playerIdHigh] = orderPlayerPair(
    narrative.playerIdLow ?? narrative.playerIdA,
    narrative.playerIdHigh ?? narrative.playerIdB,
  );
  const id = narrative.id ?? randomUUID();

  db.prepare(`
    INSERT INTO relationship_narratives (
      id, player_id_low, player_id_high, analysis_id, analysis_computed_at,
      status, narrative_text, model, prompt_version, claims_json,
      error_code, error_message, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'failed', NULL, ?, ?, NULL, ?, ?, ?, ?, ?)
    ON CONFLICT(analysis_id, analysis_computed_at) DO UPDATE SET
      player_id_low = excluded.player_id_low,
      player_id_high = excluded.player_id_high,
      status = 'failed',
      narrative_text = NULL,
      model = excluded.model,
      prompt_version = excluded.prompt_version,
      claims_json = NULL,
      error_code = excluded.error_code,
      error_message = excluded.error_message,
      created_by_user_id = COALESCE(excluded.created_by_user_id, relationship_narratives.created_by_user_id),
      updated_at = excluded.updated_at
  `).run(
    id,
    playerIdLow,
    playerIdHigh,
    narrative.analysisId,
    narrative.analysisComputedAt,
    narrative.model ?? null,
    narrative.promptVersion ?? null,
    narrative.errorCode ?? null,
    narrative.errorMessage ?? null,
    narrative.createdByUserId ?? null,
    narrative.createdAt ?? now,
    narrative.updatedAt ?? now,
  );

  return findByAnalysisVersion(narrative.analysisId, narrative.analysisComputedAt);
}
