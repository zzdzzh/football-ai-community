import { getDb } from '../connection.js';

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapFanPersonaRow(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    teamId: row.team_id,
    teamName: row.team_name,
    leagueCode: row.persona_league_code ?? row.league_code,
    styleTraits: parseJsonArray(row.style_traits_json),
    accentPhrases: parseJsonArray(row.accent_phrases_json),
    enabled: row.enabled === 1,
  };
}

export function listFanPersonas({ league = null, teamId = null } = {}) {
  const db = getDb();
  const conditions = ['fp.enabled = 1'];
  const params = [];

  if (league) {
    // 优先用 persona 自带联赛码，避免 teams 被 CL/WC sync 覆盖后筛不到国内联赛角色
    conditions.push('COALESCE(fp.league_code, t.league_code) = ?');
    params.push(league);
  }
  if (teamId) {
    conditions.push('fp.team_id = ?');
    params.push(teamId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const rows = db.prepare(`
    SELECT fp.*, t.name AS team_name, t.league_code,
           fp.league_code AS persona_league_code
    FROM fan_personas fp
    JOIN teams t ON t.id = fp.team_id
    ${whereClause}
    ORDER BY COALESCE(fp.league_code, t.league_code) ASC, t.name ASC, fp.display_name ASC
  `).all(...params);

  return rows.map(mapFanPersonaRow);
}

export function findFanPersonaById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT fp.*, t.name AS team_name, t.league_code,
           fp.league_code AS persona_league_code
    FROM fan_personas fp
    JOIN teams t ON t.id = fp.team_id
    WHERE fp.id = ?
  `).get(id);
  return row ? mapFanPersonaRow(row) : null;
}

export function findFanPersonasByIds(ids) {
  if (!ids?.length) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT fp.*, t.name AS team_name, t.league_code,
           fp.league_code AS persona_league_code
    FROM fan_personas fp
    JOIN teams t ON t.id = fp.team_id
    WHERE fp.id IN (${placeholders}) AND fp.enabled = 1
  `).all(...ids);
  return rows.map(mapFanPersonaRow);
}
