import { findMatchById } from '../db/repositories/match-repository.js';
import { findTeamById } from '../db/repositories/team-repository.js';

const CONFIDENCE_ORDER = ['low', 'medium', 'high'];

export function deriveAnalysisType(status) {
  if (status === 'FINISHED') {
    return 'post_match';
  }
  if (status === 'SCHEDULED' || status === 'LIVE') {
    return 'pre_match_prediction';
  }
  return 'pre_match_prediction';
}

function capConfidence(current, max) {
  if (CONFIDENCE_ORDER.indexOf(current) > CONFIDENCE_ORDER.indexOf(max)) {
    return max;
  }
  return current;
}

function collectMatchDataLimitations(match) {
  const limitations = [];
  if (!match.events || match.events.length === 0) {
    limitations.push('缺少比赛事件明细，无法分析具体传球线路');
  }
  if (match.dataCompleteness === 'pending') {
    limitations.push('比赛数据尚未完整同步');
  } else if (match.dataCompleteness === 'partial') {
    limitations.push('比赛统计数据不完整');
  }
  if (!match.stats || match.stats.length === 0) {
    limitations.push('缺少比赛统计数据');
  }
  if (!match.lineups?.homeFormation && !match.lineups?.awayFormation) {
    limitations.push('缺少阵容阵型数据');
  }
  return limitations;
}

function deriveMaxConfidence(match) {
  if (match.dataCompleteness === 'pending') {
    return 'low';
  }
  const limitations = collectMatchDataLimitations(match);
  if (limitations.some((item) => item.includes('事件明细'))) {
    return 'medium';
  }
  if (limitations.some((item) => item.includes('不完整'))) {
    return 'low';
  }
  return 'high';
}

function summarizeLineups(lineups) {
  if (!lineups) return undefined;
  const summarizeSide = (side) => {
    if (!side) return undefined;
    const starters = (side.players ?? []).filter((p) => !p.substitute).slice(0, 11);
    return {
      formation: side.formation ?? null,
      starters: starters.map((p) => ({
        name: p.name,
        position: p.position,
        jerseyNumber: p.jerseyNumber,
      })),
    };
  };
  return {
    homeFormation: lineups.homeFormation ?? lineups.home?.formation ?? null,
    awayFormation: lineups.awayFormation ?? lineups.away?.formation ?? null,
    home: summarizeSide(lineups.home),
    away: summarizeSide(lineups.away),
  };
}

function buildMatchPayload(match) {
  return {
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
    lineups: summarizeLineups(match.lineups),
    dataCompleteness: match.dataCompleteness,
  };
}

export function buildTacticalContext({ contextType, contextId }) {
  if (contextType === 'match') {
    const match = findMatchById(contextId);
    if (!match) {
      return { notFound: true };
    }
    const analysisType = deriveAnalysisType(match.status);
    const dataLimitations = collectMatchDataLimitations(match);
    const maxConfidence = deriveMaxConfidence(match);
    const missingFields = [];
    if (!match.stats || match.stats.length === 0) missingFields.push('stats');
    if (!match.events || match.events.length === 0) missingFields.push('events');

    return {
      contextType,
      contextId,
      analysisType,
      payload: {
        match: buildMatchPayload(match),
      },
      dataLimitations,
      maxConfidence,
      missingFields,
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
      analysisType: 'pre_match_prediction',
      payload: {
        team: {
          id: team.id,
          name: team.name,
          leagueCode: team.leagueCode,
        },
      },
      dataLimitations: ['仅球队上下文，无具体比赛事件'],
      maxConfidence: 'medium',
      missingFields: ['match'],
    };
  }

  return { invalid: true };
}

export { CONFIDENCE_ORDER };
