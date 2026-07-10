import { findMatchById } from '../db/repositories/match-repository.js';
import { findTeamById, searchTeams } from '../db/repositories/team-repository.js';

function collectMissingFields(match) {
  const missing = [];
  if (!match) return ['match'];
  if (match.homeScore === null || match.awayScore === null) missing.push('score');
  if (!match.stats || match.stats.length === 0) missing.push('stats');
  if (!match.events || match.events.length === 0) missing.push('events');
  if (match.dataCompleteness === 'pending') missing.push('sync');
  return missing;
}

export function buildStatsContext({ contextType, contextId }) {
  if (contextType === 'general') {
    return {
      contextType,
      contextId: null,
      payload: { note: '通用数据问答，无特定比赛或球队上下文' },
      missingFields: [],
      syncMessage: null,
    };
  }

  if (contextType === 'match') {
    const match = findMatchById(contextId);
    if (!match) {
      return { notFound: true };
    }
    const missingFields = collectMissingFields(match);
    return {
      contextType,
      contextId,
      payload: {
        match: {
          id: match.id,
          leagueCode: match.leagueCode,
          utcDate: match.utcDate,
          status: match.status,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          stats: match.stats ?? [],
          events: match.events ?? [],
          dataCompleteness: match.dataCompleteness,
        },
        missingFields,
      },
      missingFields,
      syncMessage: match.dataCompleteness === 'pending' ? '数据同步中' : null,
    };
  }

  if (contextType === 'team') {
    const team = findTeamById(contextId);
    if (!team) {
      return { notFound: true };
    }
    return {
      contextType,
      contextId,
      payload: {
        team: {
          id: team.id,
          name: team.name,
          leagueCode: team.leagueCode,
        },
        missingFields: [],
      },
      missingFields: [],
      syncMessage: null,
    };
  }

  return { invalid: true };
}

export function buildReportContext(match) {
  const missingFields = collectMissingFields(match);
  return {
    payload: {
      match: {
        id: match.id,
        status: match.status,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        stats: match.stats ?? [],
        events: match.events ?? [],
        dataCompleteness: match.dataCompleteness,
      },
      missingFields,
    },
    missingFields,
    isBrief: missingFields.length > 0,
  };
}

export function findSimilarTeams(query, limit = 5) {
  if (!query) return [];
  const result = searchTeams({ q: query, pageSize: limit });
  return result.items;
}
