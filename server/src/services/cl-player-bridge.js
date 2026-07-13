import { getDb } from '../db/connection.js';
import { countPlayersByLeague } from '../db/repositories/player-repository.js';
import { upsertPlayerSyncMeta } from '../db/repositories/player-sync-meta-repository.js';

export function countPlayersOnCompetitionTeams(leagueCode) {
  const db = getDb();
  return db.prepare(`
    SELECT COUNT(*) AS count
    FROM players p
    INNER JOIN teams t ON t.id = p.team_id
    WHERE t.league_code = ?
  `).get(leagueCode).count;
}

export function refreshClPlayerSyncMeta() {
  const now = new Date().toISOString();
  const playersCount = countPlayersOnCompetitionTeams('CL');
  const bridgedCount = countPlayersByLeague('CL');
  const total = Math.max(playersCount, bridgedCount);

  upsertPlayerSyncMeta({
    leagueCode: 'CL',
    lastSyncAt: now,
    lastError: total > 0 ? null : '欧冠球队暂无关联球员，请先同步五大联赛',
    status: total > 0 ? 'ok' : 'degraded',
    playersCount: total,
  });

  return { playersOnClTeams: playersCount, bridgedPlayers: bridgedCount, playersCount: total };
}
