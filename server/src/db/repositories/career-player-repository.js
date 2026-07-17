import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

/** 与入库 name_normalized 一致：去重音、折叠空白、小写（保留中日韩字符）。 */
export function normalizeCareerSearchQuery(q) {
  return String(q ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 相关性评分：精确词 > 前缀 > 子串；短关键字不做子串/词内前缀，避免 me→Messi。
 * @returns {number} 0 表示不命中
 */
export function scoreCareerPlayerName(nameNormalized, queryNormalized) {
  const name = String(nameNormalized ?? '').trim();
  const query = String(queryNormalized ?? '').trim();
  if (!name || !query) return 0;

  const words = name.split(/\s+/).filter(Boolean);
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  if (name === query) return 1000;
  if (name.startsWith(`${query} `) || name === query) return 920;

  // 短关键字：仅整词精确，禁止 me→Messi / Mees
  if (query.length < 3) {
    if (words.includes(query)) return 900;
    return 0;
  }

  const allExactWords = tokens.every((t) => words.includes(t));
  if (allExactWords) {
    const lastWordBonus = words[words.length - 1] === tokens[tokens.length - 1] ? 40 : 0;
    return 880 + lastWordBonus;
  }

  const allWordPrefixes = tokens.every((t) => words.some((w) => w.startsWith(t)));
  if (allWordPrefixes) {
    const firstBonus = words[0]?.startsWith(tokens[0]) ? 30 : 0;
    const lastBonus = words[words.length - 1]?.startsWith(tokens[tokens.length - 1]) ? 40 : 0;
    return 760 + firstBonus + lastBonus;
  }

  if (name.includes(query)) {
    const idx = name.indexOf(query);
    return Math.max(200, 480 - Math.min(idx, 200));
  }

  const allTokenSubstrings = tokens.every(
    (t) => t.length >= 3 && words.some((w) => w.includes(t)),
  );
  if (allTokenSubstrings) return 300;

  return 0;
}

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
  const queryNormalized = normalizeCareerSearchQuery(q);

  let rows;
  if (!queryNormalized) {
    rows = db.prepare(`
      SELECT p.*, (
        SELECT COUNT(*) FROM club_stints s WHERE s.player_id = p.id
      ) AS stint_count
      FROM career_players p
      ORDER BY p.name_normalized ASC
    `).all();
  } else if (queryNormalized.length < 3) {
    // 短关键字：仅词首/开头，避免 me 命中 ahmed
    rows = db.prepare(`
      SELECT p.*, (
        SELECT COUNT(*) FROM club_stints s WHERE s.player_id = p.id
      ) AS stint_count
      FROM career_players p
      WHERE p.name_normalized = ?
         OR p.name_normalized LIKE ?
         OR p.name_normalized LIKE ?
    `).all(
      queryNormalized,
      `${queryNormalized}%`,
      `% ${queryNormalized}%`,
    );
  } else {
    rows = db.prepare(`
      SELECT p.*, (
        SELECT COUNT(*) FROM club_stints s WHERE s.player_id = p.id
      ) AS stint_count
      FROM career_players p
      WHERE p.name_normalized LIKE ?
    `).all(`%${queryNormalized}%`);
  }

  const scored = rows
    .map((row) => {
      const player = mapCareerPlayerRow(row);
      const score = queryNormalized
        ? scoreCareerPlayerName(player.nameNormalized, queryNormalized)
        : 1;
      return {
        player,
        score,
        stintCount: Number(row.stint_count) || 0,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stintCount !== a.stintCount) return b.stintCount - a.stintCount;
      const readyA = a.player.syncStatus === 'ready' ? 1 : 0;
      const readyB = b.player.syncStatus === 'ready' ? 1 : 0;
      if (readyB !== readyA) return readyB - readyA;
      const clubA = a.player.currentClubName ? 1 : 0;
      const clubB = b.player.currentClubName ? 1 : 0;
      if (clubB !== clubA) return clubB - clubA;
      return a.player.nameNormalized.localeCompare(b.player.nameNormalized);
    });

  const total = scored.length;
  const pageItems = scored.slice(offset, offset + safePageSize).map((entry) => ({
    ...entry.player,
    _searchScore: entry.score,
  }));

  return {
    items: pageItems,
    total,
    page: safePage,
    pageSize: safePageSize,
    bestScore: scored[0]?.score ?? 0,
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
