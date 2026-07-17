import {
  findActiveLinkByCareerPlayerId,
  findActiveLinkByStatsPlayerId,
  findActiveLinksByCareerPlayerIds,
} from '../db/repositories/player-identity-link-repository.js';
import { getDb } from '../db/connection.js';

function mapLinkRow(row) {
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

/**
 * @param {object|null} link
 */
export function toLinkStatusItem(careerPlayerId, link) {
  if (!link) {
    return {
      careerPlayerId,
      linkState: 'unlinked',
      link: null,
      statsPlayerId: null,
      statsEntryPath: null,
    };
  }

  if (link.status === 'active' && link.confidence === 'high') {
    return {
      careerPlayerId,
      linkState: 'linked',
      link,
      statsPlayerId: link.statsPlayerId,
      statsEntryPath: `/players/${link.statsPlayerId}`,
    };
  }

  if (link.status === 'active' && link.confidence !== 'high') {
    return {
      careerPlayerId,
      linkState: 'pending_confirmation',
      link,
      statsPlayerId: link.statsPlayerId,
      statsEntryPath: `/players/${link.statsPlayerId}`,
    };
  }

  return {
    careerPlayerId,
    linkState: 'unlinked',
    link: null,
    statsPlayerId: null,
    statsEntryPath: null,
  };
}

/**
 * 批量查询履历球员 → 统计域关联状态（不编造 statsPlayerId）
 * @param {string[]} careerPlayerIds
 */
export function listLinkStatusByCareerPlayerIds(careerPlayerIds) {
  const ids = [...new Set((careerPlayerIds ?? []).map((id) => String(id).trim()).filter(Boolean))];
  const activeLinks = findActiveLinksByCareerPlayerIds(ids);
  const byCareer = new Map(activeLinks.map((l) => [l.careerPlayerId, l]));

  // 补充：同 career 下若无 active，仍可读到非 active 行（不用于 linked）
  if (ids.length > 0) {
    const db = getDb();
    const placeholders = ids.map(() => '?').join(', ');
    const rows = db.prepare(`
      SELECT * FROM player_identity_links
      WHERE career_player_id IN (${placeholders})
      ORDER BY updated_at DESC
    `).all(...ids);
    for (const row of rows) {
      if (!byCareer.has(row.career_player_id)) {
        byCareer.set(row.career_player_id, mapLinkRow(row));
      }
    }
  }

  return {
    items: ids.map((careerPlayerId) => toLinkStatusItem(careerPlayerId, byCareer.get(careerPlayerId) ?? null)),
  };
}

/**
 * 双向解析：恰好提供 statsPlayerId 或 careerPlayerId 之一
 */
export function resolvePlayerIdentityLink({ statsPlayerId, careerPlayerId } = {}) {
  const hasStats = Boolean(statsPlayerId);
  const hasCareer = Boolean(careerPlayerId);
  if (hasStats === hasCareer) {
    return {
      ok: false,
      code: 'bad_request',
      message: hasStats
        ? '请仅提供 statsPlayerId 或 careerPlayerId 之一'
        : '必须提供 statsPlayerId 或 careerPlayerId',
    };
  }

  const link = hasStats
    ? findActiveLinkByStatsPlayerId(String(statsPlayerId))
    : findActiveLinkByCareerPlayerId(String(careerPlayerId));

  if (!link) {
    return { ok: false, code: 'not_found', message: '未找到身份映射' };
  }

  return { ok: true, link };
}

export function createPlayerIdentityResolveService() {
  return {
    listLinkStatusByCareerPlayerIds,
    resolvePlayerIdentityLink,
    toLinkStatusItem,
  };
}

export const playerIdentityResolveService = createPlayerIdentityResolveService();
