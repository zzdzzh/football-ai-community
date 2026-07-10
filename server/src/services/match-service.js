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
  } else if (
    match.status === 'FINISHED'
    && (!match.stats || match.stats.length === 0)
  ) {
    detail.syncMessage = match.id.startsWith('ss-')
      ? '比赛统计同步中，请触发 match-sync 后刷新'
      : '该比赛暂无统计数据，建议选择英超（PL）爬虫同步的比赛进行战术分析';
  }

  return detail;
}

export function getRecentMatchesForTeam(teamId, limit = 5) {
  return listRecentMatchesByTeamId(teamId, limit).map(toMatchSummary);
}
