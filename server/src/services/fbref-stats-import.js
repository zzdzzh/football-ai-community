import { getDb } from '../db/connection.js';
import { findPlayerById, upsertPlayer } from '../db/repositories/player-repository.js';
import {
  findPlayerStatsSnapshot,
  upsertPlayerStatsSnapshot,
} from '../db/repositories/player-stats-snapshot-repository.js';
import { buildPlayerNameIndex, resolvePlayerByName } from './fbref-player-matcher.js';

function listLeaguePlayers(leagueCode) {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, team_id
    FROM players
    WHERE league_code = ?
  `).all(leagueCode);
}

function mergeStatValue(existingValue, incomingValue) {
  if (existingValue != null && existingValue > 0) {
    return existingValue;
  }
  return incomingValue ?? existingValue ?? 0;
}

export function mergeFbrefStatsForLeague({ leagueCode, season, fbrefStats = [], now }) {
  if (!fbrefStats.length) {
    return { matched: 0, unmatched: 0 };
  }

  const index = buildPlayerNameIndex(listLeaguePlayers(leagueCode));
  let matched = 0;
  let unmatched = 0;

  for (const stat of fbrefStats) {
    const row = resolvePlayerByName(stat.name, index);
    if (!row) {
      unmatched += 1;
      continue;
    }

    const player = findPlayerById(row.id);
    if (!player) {
      unmatched += 1;
      continue;
    }

    matched += 1;
    const targetSeason = stat.season ?? season;
    const existing = findPlayerStatsSnapshot(player.id, leagueCode, targetSeason);

    upsertPlayer({
      id: player.id,
      name: player.name,
      teamId: player.teamId,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      leagueCode: player.leagueCode,
      fbrefId: stat.fbrefId,
      updatedAt: now,
    });

    upsertPlayerStatsSnapshot({
      playerId: player.id,
      leagueCode,
      season: targetSeason,
      goals: mergeStatValue(existing?.goals, stat.goals),
      assists: mergeStatValue(existing?.assists, stat.assists),
      penalties: existing?.penalties ?? 0,
      appearances: existing?.appearances ?? null,
      minutes: stat.minutes ?? existing?.minutes ?? null,
      xg: stat.xg ?? existing?.xg ?? null,
      xa: stat.xa ?? existing?.xa ?? null,
      rating: existing?.rating ?? null,
      syncedAt: now,
    });
  }

  return { matched, unmatched };
}
