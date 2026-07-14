import { getDb } from '../db/connection.js';
import {
  findPlayerById,
  findPlayerBySofascoreId,
  upsertPlayer,
} from '../db/repositories/player-repository.js';
import {
  findPlayerStatsSnapshot,
  upsertPlayerStatsSnapshot,
} from '../db/repositories/player-stats-snapshot-repository.js';
import { buildPlayerNameIndex, resolvePlayerByName } from './fbref-player-matcher.js';

function listLeaguePlayers(leagueCode) {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, team_id, sofascore_id
    FROM players
    WHERE league_code = ?
  `).all(leagueCode);
}

function mergePreferExisting(existingValue, incomingValue) {
  if (existingValue != null && existingValue > 0) {
    return existingValue;
  }
  return incomingValue ?? existingValue ?? 0;
}

function resolveSeasonLabel(stat, fallbackSeason) {
  if (!stat.season) return fallbackSeason;
  // SofaScore season 可能是 "24/25" 或 "2024-25"，与 scorers 的年份对齐时优先用 fallback
  if (/^\d{4}$/.test(String(fallbackSeason)) && String(stat.season).includes('/')) {
    return fallbackSeason;
  }
  return String(stat.season);
}

export function mergeSofaPlayerStatsForLeague({ leagueCode, season, sofaPlayerStats = [], now }) {
  if (!sofaPlayerStats.length) {
    return { matched: 0, unmatched: 0 };
  }

  const players = listLeaguePlayers(leagueCode);
  const nameIndex = buildPlayerNameIndex(players);
  let matched = 0;
  let unmatched = 0;

  for (const stat of sofaPlayerStats) {
    let row = null;
    if (stat.sofascoreId) {
      const bySofa = findPlayerBySofascoreId(stat.sofascoreId);
      if (bySofa && bySofa.leagueCode === leagueCode) {
        row = { id: bySofa.id, name: bySofa.name, team_id: bySofa.teamId };
      }
    }
    if (!row) {
      row = resolvePlayerByName(stat.name, nameIndex);
    }
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
    const targetSeason = resolveSeasonLabel(stat, season);
    const existing = findPlayerStatsSnapshot(player.id, leagueCode, targetSeason);

    upsertPlayer({
      id: player.id,
      name: player.name,
      teamId: player.teamId,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      leagueCode: player.leagueCode,
      sofascoreId: stat.sofascoreId ?? undefined,
      updatedAt: now,
    });

    upsertPlayerStatsSnapshot({
      playerId: player.id,
      leagueCode,
      season: targetSeason,
      goals: mergePreferExisting(existing?.goals, stat.goals),
      assists: mergePreferExisting(existing?.assists, stat.assists),
      penalties: existing?.penalties ?? 0,
      appearances: existing?.appearances ?? stat.appearances ?? null,
      minutes: existing?.minutes ?? stat.minutes ?? null,
      xg: existing?.xg ?? null,
      xa: existing?.xa ?? null,
      rating: stat.rating ?? existing?.rating ?? null,
      syncedAt: now,
    });
  }

  return { matched, unmatched };
}
