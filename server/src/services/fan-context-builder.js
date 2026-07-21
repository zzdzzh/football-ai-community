import { findMatchById } from '../db/repositories/match-repository.js';
import { findFeedItemByMatchIdAndType } from '../db/repositories/feed-item-repository.js';

export function buildFanContext({ topic, matchId = null }) {
  const context = {
    topic: topic?.trim() ?? '',
    matchSummary: null,
    feedSnippet: null,
  };

  if (!matchId) {
    return context;
  }

  const match = findMatchById(matchId);
  if (!match) {
    return { ...context, notFound: true };
  }

  const homeName = match.homeTeam?.name ?? match.homeTeam?.id ?? '主队';
  const awayName = match.awayTeam?.name ?? match.awayTeam?.id ?? '客队';
  const scorePart = match.homeScore != null && match.awayScore != null
    ? `${match.homeScore}-${match.awayScore}`
    : 'vs';
  context.matchSummary = `${homeName} ${scorePart} ${awayName}（${match.status}）`;

  const reportFeed = findFeedItemByMatchIdAndType(matchId, 'match_report')
    ?? findFeedItemByMatchIdAndType(matchId, 'brief_report');
  if (reportFeed?.summary) {
    context.feedSnippet = reportFeed.summary;
  }

  return context;
}
