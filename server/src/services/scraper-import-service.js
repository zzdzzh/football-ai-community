import { getDb } from '../db/connection.js';
import {
  findTeamByNormalizedName,
  findTeamBySofascoreId,
  findTeamByTransfermarktId,
  findTeamById,
  upsertTeam,
} from '../db/repositories/team-repository.js';
import {
  upsertPlayer,
  countPlayersByLeague,
  findPlayerBySofascoreId,
  findPlayerById,
} from '../db/repositories/player-repository.js';
import {
  upsertPlayerStatsSnapshot,
  deleteUntrustedThinSnapshots,
  isUntrustedThinSnapshot,
} from '../db/repositories/player-stats-snapshot-repository.js';
import { upsertPlayerSyncMeta } from '../db/repositories/player-sync-meta-repository.js';
import {
  upsertMatch,
  findMatchById,
  resolveCanonicalMatchId,
} from '../db/repositories/match-repository.js';
import { upsertMatchSyncMeta } from '../db/repositories/match-sync-meta-repository.js';
import { syncLeagueFromScraper } from '../adapters/scraper-runner.js';
import { mergeFbrefStatsForLeague } from './fbref-stats-import.js';
import { mergeSofaPlayerStatsForLeague } from './sofa-stats-import.js';
import { buildPlayerNameIndex, resolvePlayerByName } from './fbref-player-matcher.js';
import { isClubLeague, isCompetitionLeague } from '../constants/league-codes.js';

function hasExternalId(value) {
  return value != null && String(value).trim() !== '' && String(value) !== 'null';
}

function resolveTeamId(scrapedTeam) {
  const { transfermarktId, sofascoreId, name, leagueCode } = scrapedTeam;

  if (hasExternalId(transfermarktId)) {
    const byTm = findTeamByTransfermarktId(String(transfermarktId));
    if (byTm) return byTm.id;
  }
  if (hasExternalId(sofascoreId)) {
    const bySofa = findTeamBySofascoreId(String(sofascoreId));
    if (bySofa) return bySofa.id;
  }
  const byName = findTeamByNormalizedName(name, leagueCode);
  if (byName) return byName.id;

  if (hasExternalId(sofascoreId)) return `ss-${sofascoreId}`;
  if (hasExternalId(transfermarktId)) return `tm-${transfermarktId}`;
  return `name-${leagueCode}-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function registerTeamIdKeys(map, team, id) {
  if (hasExternalId(team.transfermarktId)) {
    map.set(String(team.transfermarktId), id);
  }
  if (hasExternalId(team.sofascoreId)) {
    map.set(`ss:${team.sofascoreId}`, id);
  }
  map.set(team.name, id);
  if (team.transfermarktName) {
    map.set(team.transfermarktName, id);
  }
}

function buildTeamIdMap(payload) {
  const map = new Map();
  for (const team of payload.teams ?? []) {
    registerTeamIdKeys(map, team, resolveTeamId(team));
  }
  return map;
}

function resolvePlayerTeamId(player, teamIdMap) {
  if (hasExternalId(player.teamTransfermarktId)) {
    const byTm = teamIdMap.get(String(player.teamTransfermarktId));
    if (byTm) return byTm;
  }
  if (hasExternalId(player.teamSofascoreId)) {
    return teamIdMap.get(`ss:${player.teamSofascoreId}`) ?? null;
  }
  return null;
}

function resolveMatchTeamId(teamRef, teamIdMap, leagueCode) {
  if (!teamRef) return null;
  const bySofa = teamIdMap.get(`ss:${teamRef.sofascoreId}`);
  if (bySofa) return bySofa;
  const byName = teamIdMap.get(teamRef.name);
  if (byName) return byName;
  const resolved = resolveTeamId({
    name: teamRef.name,
    shortName: teamRef.shortName,
    sofascoreId: teamRef.sofascoreId,
    transfermarktId: null,
    leagueCode,
  });
  upsertTeam({
    id: resolved,
    name: teamRef.name,
    shortName: teamRef.shortName,
    leagueCode,
    sofascoreId: teamRef.sofascoreId,
  });
  return resolved;
}

function findExistingPlayerId(player, teamId) {
  if (player.sofascoreId) {
    const bySofa = findPlayerBySofascoreId(String(player.sofascoreId));
    if (bySofa) return bySofa.id;
  }
  if (player.id) {
    const byId = findPlayerById(player.id);
    if (byId) return byId.id;
  }
  const rows = getDb().prepare(`
    SELECT id, name FROM players WHERE team_id = ?
  `).all(teamId);
  const match = resolvePlayerByName(player.name, buildPlayerNameIndex(rows));
  return match?.id ?? null;
}

export async function importLeagueFromScraper(leagueCode, { includeFbref = true, playersOnly = false } = {}) {
  const now = new Date().toISOString();
  try {
    const purgedUntrusted = deleteUntrustedThinSnapshots();
    const payload = await syncLeagueFromScraper(leagueCode, { includeFbref, playersOnly });
    const teamIdMap = buildTeamIdMap(payload);
    const squadErrors = payload.squadErrors ?? [];

    const db = getDb();
    const tx = db.transaction(() => {
      for (const team of payload.teams ?? []) {
        const id = resolveTeamId(team);
        registerTeamIdKeys(teamIdMap, team, id);
        const existingTeam = findTeamById(id);
        const leagueCode = (existingTeam
          && isClubLeague(existingTeam.leagueCode)
          && isCompetitionLeague(team.leagueCode))
          ? existingTeam.leagueCode
          : team.leagueCode;
        upsertTeam({
          id,
          name: team.name,
          shortName: team.shortName,
          leagueCode,
          sofascoreId: team.sofascoreId,
          transfermarktId: team.transfermarktId,
          updatedAt: now,
        });
      }

      const playerIdRemap = new Map();
      for (const player of payload.players ?? []) {
        const teamId = resolvePlayerTeamId(player, teamIdMap);
        if (!teamId) continue;
        const resolvedId = findExistingPlayerId(player, teamId) ?? player.id;
        if (player.id && resolvedId !== player.id) {
          playerIdRemap.set(player.id, resolvedId);
        }
        const existingPlayer = findPlayerById(resolvedId);
        // 杯赛/国家队阵容不得覆盖已有五大联赛俱乐部归属
        if (existingPlayer
          && isClubLeague(existingPlayer.leagueCode)
          && isCompetitionLeague(player.leagueCode)) {
          continue;
        }
        upsertPlayer({
          id: resolvedId,
          name: player.name,
          teamId,
          position: player.position,
          dateOfBirth: player.dateOfBirth,
          nationality: player.nationality,
          leagueCode: player.leagueCode,
          transfermarktId: player.transfermarktId,
          sofascoreId: player.sofascoreId,
          updatedAt: now,
        });
      }

      for (const scorer of payload.scorers ?? []) {
        const playerId = playerIdRemap.get(scorer.playerId) ?? scorer.playerId;
        if (!findPlayerById(playerId)) continue;
        // 跳过无佐证的高进球薄记录，避免再度写入污染数据
        if (isUntrustedThinSnapshot({
          goals: scorer.goals ?? 0,
          assists: scorer.assists ?? 0,
          appearances: scorer.appearances ?? null,
          minutes: null,
          rating: null,
          xg: null,
          xa: null,
          extraStats: null,
        })) {
          continue;
        }
        upsertPlayerStatsSnapshot({
          playerId,
          leagueCode: scorer.leagueCode,
          season: scorer.season,
          goals: scorer.goals,
          assists: scorer.assists,
          penalties: scorer.penalties,
          appearances: scorer.appearances,
          syncedAt: now,
        });
      }

      for (const match of payload.matches ?? []) {
        const homeTeamId = resolveMatchTeamId(match.homeTeam, teamIdMap, match.leagueCode);
        const awayTeamId = resolveMatchTeamId(match.awayTeam, teamIdMap, match.leagueCode);
        if (!homeTeamId || !awayTeamId) continue;
        const matchId = resolveCanonicalMatchId({
          id: match.id,
          leagueCode: match.leagueCode,
          homeTeamId,
          awayTeamId,
          utcDate: match.utcDate,
        });
        const existing = findMatchById(matchId);
        upsertMatch({
          id: matchId,
          leagueCode: match.leagueCode,
          season: match.season,
          matchday: match.matchday,
          utcDate: match.utcDate,
          status: match.status,
          homeTeamId,
          awayTeamId,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          statsJson: null,
          eventsJson: null,
          lineupsJson: null,
          dataCompleteness: existing?.stats?.length
            ? existing.dataCompleteness
            : (match.dataCompleteness ?? 'partial'),
          lastSyncedAt: now,
        });
      }

      upsertPlayerSyncMeta({
        leagueCode,
        lastSyncAt: now,
        lastError: squadErrors.length > 0 ? squadErrors.slice(0, 3).join('; ') : null,
        status: squadErrors.length > 0 ? 'degraded' : 'ok',
        playersCount: countPlayersByLeague(leagueCode),
      });

      upsertMatchSyncMeta({
        leagueCode,
        lastSyncAt: now,
        lastError: null,
        status: 'ok',
        requestsInWindow: 0,
        windowStartedAt: now,
      });
    });
    tx();

    const seasonYear = payload.scorers?.[0]?.season
      ?? payload.fbrefStats?.[0]?.season
      ?? String(new Date().getFullYear());
    const fbrefResult = includeFbref && payload.fbrefStats?.length
      ? mergeFbrefStatsForLeague({
        leagueCode,
        season: seasonYear,
        fbrefStats: payload.fbrefStats,
        now,
      })
      : { matched: 0, unmatched: 0 };

    const sofaResult = payload.sofaPlayerStats?.length
      ? mergeSofaPlayerStatsForLeague({
        leagueCode,
        season: seasonYear,
        sofaPlayerStats: payload.sofaPlayerStats,
        now,
      })
      : { matched: 0, unmatched: 0 };

    return {
      leagueCode,
      syncedTeams: payload.teams?.length ?? 0,
      syncedPlayers: payload.players?.length ?? 0,
      syncedMatches: payload.matches?.length ?? 0,
      syncedScorers: payload.scorers?.length ?? 0,
      purgedUntrusted,
      fbrefMatched: fbrefResult.matched,
      fbrefUnmatched: fbrefResult.unmatched,
      sofaMatched: sofaResult.matched,
      sofaUnmatched: sofaResult.unmatched,
      linkedSofascoreIds: payload.linkedSofascoreIds ?? 0,
      squadErrors,
      sources: payload.sources ?? {},
    };
  } catch (err) {
    upsertPlayerSyncMeta({
      leagueCode,
      lastSyncAt: now,
      lastError: err.message,
      status: 'down',
      playersCount: countPlayersByLeague(leagueCode),
    });
    throw err;
  }
}
