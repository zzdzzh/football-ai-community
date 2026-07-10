import { config } from '../config/index.js';
import {
  ALLOWED_LEAGUES,
  updateRateLimitWindow,
  findMatchSyncMetaByLeague,
} from '../db/repositories/match-sync-meta-repository.js';

export { ALLOWED_LEAGUES };

const MAX_REQUESTS_PER_MINUTE = 8;
const WINDOW_MS = 60_000;

class RateLimiter {
  constructor() {
    this.timestamps = [];
  }

  async acquire() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (this.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      const waitMs = WINDOW_MS - (now - this.timestamps[0]) + 50;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.acquire();
    }
    this.timestamps.push(Date.now());
  }
}

const globalRateLimiter = new RateLimiter();

export function resetRateLimiterForTest() {
  globalRateLimiter.timestamps = [];
}

function mapTeamFromApi(team, leagueCode) {
  return {
    id: String(team.id),
    name: team.name,
    shortName: team.shortName ?? undefined,
    tla: team.tla ?? undefined,
    crestUrl: team.crest ?? undefined,
    leagueCode,
  };
}

function mapScore(score) {
  if (!score?.fullTime) return { home: null, away: null };
  return {
    home: score.fullTime.home ?? null,
    away: score.fullTime.away ?? null,
  };
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

function mapStatsFromApi(statistics) {
  if (!Array.isArray(statistics) || statistics.length < 2) return [];
  const home = statistics[0]?.statistics ?? [];
  const away = statistics[1]?.statistics ?? [];
  const result = [];
  for (const homeStat of home) {
    const awayStat = away.find((s) => s.type === homeStat.type);
    if (!awayStat) continue;
    result.push({
      name: homeStat.type,
      homeValue: parseStatValue(homeStat.value),
      awayValue: parseStatValue(awayStat.value),
      unit: inferUnit(homeStat.type),
    });
  }
  return result;
}

function parseStatValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = value.replace('%', '');
    const parsed = Number(numeric);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function inferUnit(type) {
  if (type?.includes('percentage') || type === 'Ball Possession') return '%';
  return undefined;
}

function mapEventsFromApi(goals, bookings, substitutions) {
  const events = [];
  for (const goal of goals ?? []) {
    events.push({
      minute: goal.minute ?? 0,
      type: goal.type === 'OWN' ? 'OWN_GOAL' : goal.type === 'PENALTY' ? 'PENALTY' : 'GOAL',
      teamId: String(goal.team?.id ?? goal.teamId ?? ''),
      playerName: goal.scorer?.name ?? goal.player?.name ?? undefined,
      detail: goal.assist?.name ? `助攻: ${goal.assist.name}` : undefined,
    });
  }
  for (const card of bookings ?? []) {
    events.push({
      minute: card.minute ?? 0,
      type: card.card === 'RED_CARD' ? 'RED_CARD' : 'YELLOW_CARD',
      teamId: String(card.team?.id ?? ''),
      playerName: card.player?.name ?? undefined,
    });
  }
  for (const sub of substitutions ?? []) {
    events.push({
      minute: sub.minute ?? 0,
      type: 'SUBSTITUTION',
      teamId: String(sub.team?.id ?? ''),
      playerName: sub.playerOut?.name ?? undefined,
      detail: sub.playerIn?.name ? `换上: ${sub.playerIn.name}` : undefined,
    });
  }
  return events.sort((a, b) => a.minute - b.minute);
}

function mapMatchFromApi(match, leagueCode) {
  const homeTeam = mapTeamFromApi(match.homeTeam, leagueCode);
  const awayTeam = mapTeamFromApi(match.awayTeam, leagueCode);
  const scores = mapScore(match.score);
  const stats = match.statistics ? mapStatsFromApi(match.statistics) : undefined;
  const events = match.goals || match.bookings || match.substitutions
    ? mapEventsFromApi(match.goals, match.bookings, match.substitutions)
    : undefined;

  return {
    id: String(match.id),
    leagueCode,
    season: match.season?.startDate?.slice(0, 4) ?? undefined,
    matchday: match.matchday ?? undefined,
    utcDate: match.utcDate,
    status: match.status,
    homeTeam,
    awayTeam,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeScore: scores.home,
    awayScore: scores.away,
    statsJson: stats,
    eventsJson: events,
    dataCompleteness: inferDataCompleteness({
      status: match.status,
      stats,
      events,
      homeScore: scores.home,
      awayScore: scores.away,
    }),
  };
}

export class FootballDataAdapter {
  constructor({ apiKey, baseUrl, fetchImpl = fetch } = {}) {
    this.apiKey = apiKey ?? config.footballData.apiKey;
    this.baseUrl = (baseUrl ?? config.footballData.baseUrl).replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async request(path, { leagueCode = null } = {}) {
    if (!this.apiKey) {
      const error = new Error('football-data API key 未配置');
      error.code = 'API_KEY_MISSING';
      throw error;
    }

    await globalRateLimiter.acquire();

    if (leagueCode) {
      const meta = findMatchSyncMetaByLeague(leagueCode);
      const windowStart = meta?.windowStartedAt ?? new Date().toISOString();
      const count = (meta?.requestsInWindow ?? 0) + 1;
      updateRateLimitWindow({
        leagueCode,
        requestsInWindow: count,
        windowStartedAt: windowStart,
      });
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { 'X-Auth-Token': this.apiKey },
    });

    if (response.status === 429) {
      const error = new Error('football-data.org 速率限制');
      error.code = 'RATE_LIMITED';
      error.statusCode = 429;
      throw error;
    }

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`football-data 请求失败: ${response.status}`);
      error.statusCode = response.status;
      error.details = body;
      throw error;
    }

    return response.json();
  }

  async getCompetitionMatches(leagueCode, { status = null } = {}) {
    if (!ALLOWED_LEAGUES.includes(leagueCode)) {
      throw new Error(`联赛 ${leagueCode} 不在白名单内`);
    }
    const statusQuery = status ? `?status=${status}` : '';
    const data = await this.request(`/competitions/${leagueCode}/matches${statusQuery}`, { leagueCode });
    return (data.matches ?? []).map((match) => mapMatchFromApi(match, leagueCode));
  }

  async getMatch(matchId) {
    const data = await this.request(`/matches/${matchId}`);
    const leagueCode = data.competition?.code ?? data.competition?.id ?? 'PL';
    return mapMatchFromApi(data, leagueCode);
  }

  async getCompetitionTeams(leagueCode) {
    if (!ALLOWED_LEAGUES.includes(leagueCode)) {
      throw new Error(`联赛 ${leagueCode} 不在白名单内`);
    }
    const data = await this.request(`/competitions/${leagueCode}/teams`, { leagueCode });
    return (data.teams ?? []).map((team) => mapTeamFromApi(team, leagueCode));
  }
}

export function createFootballDataAdapter(overrides = {}) {
  return new FootballDataAdapter(overrides);
}
