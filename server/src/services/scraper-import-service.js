import { getDb } from '../db/connection.js';
import {
  findTeamByNormalizedName,
  findTeamBySofascoreId,
  findTeamByTransfermarktId,
  upsertTeam,
} from '../db/repositories/team-repository.js';
import { upsertPlayer, countPlayersByLeague } from '../db/repositories/player-repository.js';
import { upsertPlayerStatsSnapshot } from '../db/repositories/player-stats-snapshot-repository.js';
import { upsertPlayerSyncMeta } from '../db/repositories/player-sync-meta-repository.js';
import { upsertMatch } from '../db/repositories/match-repository.js';
import { upsertMatchSyncMeta } from '../db/repositories/match-sync-meta-repository.js';
import { syncLeagueFromScraper } from '../adapters/scraper-runner.js';

function resolveTeamId(scrapedTeam) {
  const { transfermarktId, sofascoreId, name, leagueCode } = scrapedTeam;

  if (transfermarktId) {
    const byTm = findTeamByTransfermarktId(String(transfermarktId));
    if (byTm) return byTm.id;
  }
  if (sofascoreId) {
    const bySofa = findTeamBySofascoreId(String(sofascoreId));
    if (bySofa) return bySofa.id;
  }
  const byName = findTeamByNormalizedName(name, leagueCode);
  if (byName) return byName.id;

  if (sofascoreId) return `ss-${sofascoreId}`;
  if (transfermarktId) return `tm-${transfermarktId}`;
  return `name-${leagueCode}-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function buildTeamIdMap(payload) {
  const map = new Map();
  for (const team of payload.teams ?? []) {
    const id = resolveTeamId(team);
    map.set(String(team.transfermarktId), id);
    if (team.sofascoreId) {
      map.set(`ss:${team.sofascoreId}`, id);
    }
    map.set(team.name, id);
    if (team.transfermarktName) {
      map.set(team.transfermarktName, id);
    }
  }
  return map;
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

export async function importLeagueFromScraper(leagueCode, { includeFbref = false, playersOnly = false } = {}) {
  const now = new Date().toISOString();
  try {
    const payload = await syncLeagueFromScraper(leagueCode, { includeFbref, playersOnly });
    const teamIdMap = buildTeamIdMap(payload);
    const squadErrors = payload.squadErrors ?? [];

    const db = getDb();
    const tx = db.transaction(() => {
      for (const team of payload.teams ?? []) {
        const id = resolveTeamId(team);
        teamIdMap.set(String(team.transfermarktId), id);
      if (team.sofascoreId) teamIdMap.set(`ss:${team.sofascoreId}`, id);
      teamIdMap.set(team.name, id);
      if (team.transfermarktName) teamIdMap.set(team.transfermarktName, id);
        upsertTeam({
          id,
          name: team.name,
          shortName: team.shortName,
          leagueCode: team.leagueCode,
          sofascoreId: team.sofascoreId,
          transfermarktId: team.transfermarktId,
          updatedAt: now,
        });
      }

      for (const player of payload.players ?? []) {
        const teamId = teamIdMap.get(String(player.teamTransfermarktId));
        if (!teamId) continue;
        upsertPlayer({
          id: player.id,
          name: player.name,
          teamId,
          position: player.position,
          dateOfBirth: player.dateOfBirth,
          nationality: player.nationality,
          leagueCode: player.leagueCode,
          transfermarktId: player.transfermarktId,
          updatedAt: now,
        });
      }

      for (const scorer of payload.scorers ?? []) {
        upsertPlayerStatsSnapshot({
          playerId: scorer.playerId,
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
        upsertMatch({
          id: match.id,
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
          dataCompleteness: match.dataCompleteness ?? 'partial',
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

    return {
      leagueCode,
      syncedTeams: payload.teams?.length ?? 0,
      syncedPlayers: payload.players?.length ?? 0,
      syncedMatches: payload.matches?.length ?? 0,
      syncedScorers: payload.scorers?.length ?? 0,
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
