import {
  findPlayerById,
  findPlayerBySofascoreId,
  upsertPlayer,
} from '../db/repositories/player-repository.js';
import { findTeamBySofascoreId } from '../db/repositories/team-repository.js';
import {
  findPlayerStatsSnapshot,
  upsertPlayerStatsSnapshot,
} from '../db/repositories/player-stats-snapshot-repository.js';
import { buildPlayerNameIndex, resolvePlayerByName } from './fbref-player-matcher.js';
import { isClubLeague, isCompetitionLeague } from '../constants/league-codes.js';
import { getDb } from '../db/connection.js';

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

function resolveTeamIdFromSofaStat(stat, leagueCode, fallbackTeamId) {
  if (!stat.teamSofascoreId) {
    return fallbackTeamId;
  }
  const team = findTeamBySofascoreId(String(stat.teamSofascoreId));
  if (!team) {
    return fallbackTeamId;
  }
  // 优先采用当前联赛球队；其次允许用五大联赛球队修复杯赛错挂
  if (team.leagueCode === leagueCode || isClubLeague(team.leagueCode)) {
    return team.id;
  }
  return fallbackTeamId;
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
      // 允许跨赛事匹配：用五大联赛统计修复被 CL/WC 错挂球队的同一 sofascore 球员
      if (bySofa && (bySofa.leagueCode === leagueCode || isCompetitionLeague(bySofa.leagueCode))) {
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
    const teamId = resolveTeamIdFromSofaStat(stat, leagueCode, player.teamId);
    const nextLeagueCode = (isClubLeague(leagueCode) && isCompetitionLeague(player.leagueCode))
      ? leagueCode
      : player.leagueCode;

    upsertPlayer({
      id: player.id,
      name: player.name,
      teamId,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      leagueCode: nextLeagueCode,
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
