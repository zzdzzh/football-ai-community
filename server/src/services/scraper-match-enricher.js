import { fetchScraperMatchDetail } from '../adapters/scraper-runner.js';
import { findFinishedScraperMatchesMissingStats, upsertMatch } from '../db/repositories/match-repository.js';

const SKIP_INCIDENT_TYPES = new Set(['period', 'injuryTime']);

function parseStatValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = value.replace('%', '').trim();
    const parsed = Number(numeric);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function inferUnit(name, rawValue) {
  if (typeof rawValue === 'string' && rawValue.includes('%')) return '%';
  const lower = (name ?? '').toLowerCase();
  if (lower.includes('possession')) return '%';
  return undefined;
}

function inferDataCompleteness({ status, stats, events, homeScore, awayScore }) {
  if (status !== 'FINISHED') return 'pending';
  const hasScores = homeScore !== null && awayScore !== null;
  const hasStats = Array.isArray(stats) && stats.length > 0;
  const hasEvents = Array.isArray(events) && events.length > 0;
  if (hasScores && hasStats && hasEvents) return 'complete';
  if (hasScores || hasStats || hasEvents) return 'partial';
  return 'pending';
}

export function mapScraperMatchDetail(payload) {
  const stats = [];
  const statBlocks = payload?.statistics?.statistics;
  if (Array.isArray(statBlocks) && statBlocks.length > 0) {
    for (const group of statBlocks[0].groups ?? []) {
      for (const item of group.statisticsItems ?? []) {
        stats.push({
          name: item.name,
          homeValue: item.homeValue ?? parseStatValue(item.home),
          awayValue: item.awayValue ?? parseStatValue(item.away),
          unit: inferUnit(item.name, item.home),
        });
      }
    }
  }

  const event = payload?.event ?? {};
  const homeTeamId = event.homeTeam?.id ? String(event.homeTeam.id) : '';
  const awayTeamId = event.awayTeam?.id ? String(event.awayTeam.id) : '';
  const events = [];
  for (const incident of payload?.incidents?.incidents ?? []) {
    const mapped = mapIncident(incident, { homeTeamId, awayTeamId });
    if (mapped) events.push(mapped);
  }
  events.sort((a, b) => a.minute - b.minute);

  const statusType = (event.status ?? {}).type ?? '';
  const status = statusType === 'finished' ? 'FINISHED' : 'SCHEDULED';
  const homeScore = event.homeScore?.current ?? event.homeScore?.display ?? null;
  const awayScore = event.awayScore?.current ?? event.awayScore?.display ?? null;

  return {
    stats,
    events,
    dataCompleteness: inferDataCompleteness({
      status,
      stats,
      events,
      homeScore,
      awayScore,
    }),
  };
}

function mapIncident(incident, { homeTeamId, awayTeamId }) {
  const incidentType = incident.incidentType;
  if (!incidentType || SKIP_INCIDENT_TYPES.has(incidentType)) {
    return null;
  }

  const minute = incident.time ?? incident.minute ?? 0;
  const teamId = incident.isHome ? homeTeamId : awayTeamId;
  const playerName = incident.player?.name ?? incident.playerName ?? undefined;

  if (incidentType === 'goal') {
    const assistName = incident.assist1?.name ?? incident.assist?.name;
    return {
      minute,
      type: 'GOAL',
      teamId,
      playerName,
      detail: assistName ? `助攻: ${assistName}` : undefined,
    };
  }

  if (incidentType === 'card') {
    const cardClass = (incident.incidentClass ?? '').toLowerCase();
    const type = cardClass.includes('red') ? 'RED_CARD' : 'YELLOW_CARD';
    return { minute, type, teamId, playerName, detail: incident.reason ?? undefined };
  }

  if (incidentType === 'substitution') {
    const playerIn = incident.playerIn?.name ?? incident.playerInName;
    return {
      minute,
      type: 'SUBSTITUTION',
      teamId,
      playerName: incident.playerOut?.name ?? playerName,
      detail: playerIn ? `换上: ${playerIn}` : undefined,
    };
  }

  return null;
}

export function extractSofascoreId(matchId) {
  if (!matchId?.startsWith('ss-')) return null;
  return matchId.slice(3);
}

export async function enrichScraperFinishedMatches({ limit = 5 } = {}) {
  const pending = findFinishedScraperMatchesMissingStats(limit);
  const results = [];

  for (const match of pending) {
    const sofascoreId = extractSofascoreId(match.id);
    try {
      const detail = await fetchScraperMatchDetail(sofascoreId);
      const mapped = mapScraperMatchDetail(detail);
      const now = new Date().toISOString();
      upsertMatch({
        id: match.id,
        leagueCode: match.leagueCode,
        season: match.season,
        matchday: match.matchday,
        utcDate: match.utcDate,
        status: match.status,
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        statsJson: mapped.stats.length > 0 ? mapped.stats : null,
        eventsJson: mapped.events.length > 0 ? mapped.events : null,
        dataCompleteness: mapped.dataCompleteness,
        lastSyncedAt: now,
      });
      results.push({
        matchId: match.id,
        statsCount: mapped.stats.length,
        eventsCount: mapped.events.length,
        dataCompleteness: mapped.dataCompleteness,
      });
    } catch (err) {
      results.push({ matchId: match.id, error: err.message });
      console.error(JSON.stringify({
        level: 'error',
        type: 'scraper_match_enrich_failed',
        matchId: match.id,
        sofascoreId,
        message: err.message,
      }));
    }
  }

  return results;
}
