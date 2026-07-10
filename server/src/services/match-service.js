import {
  listMatches,
  findMatchById,
  listRecentMatchesByTeamId,
} from '../db/repositories/match-repository.js';
import { getAggregateMatchSyncStatus } from '../db/repositories/match-sync-meta-repository.js';

function toMatchSummary(match) {
  return {
    id: match.id,
    leagueCode: match.leagueCode,
    utcDate: match.utcDate,
    status: match.status,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore ?? null,
    awayScore: match.awayScore ?? null,
    dataCompleteness: match.dataCompleteness,
  };
}

export function listMatchSummaries(filters = {}) {
  const result = listMatches(filters);
  const syncMeta = getAggregateMatchSyncStatus();
  return {
    items: result.items.map(toMatchSummary),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    syncStatus: syncMeta.status,
    warnings: syncMeta.warnings,
  };
}

export function getMatchDetail(matchId) {
  const match = findMatchById(matchId);
  if (!match) return null;

  const detail = {
    ...toMatchSummary(match),
    season: match.season,
    matchday: match.matchday,
    stats: match.stats ?? [],
    events: match.events ?? [],
  };

  if (match.dataCompleteness === 'pending') {
    detail.syncMessage = '数据同步中';
  }

  return detail;
}

export function getRecentMatchesForTeam(teamId, limit = 5) {
  return listRecentMatchesByTeamId(teamId, limit).map(toMatchSummary);
}
