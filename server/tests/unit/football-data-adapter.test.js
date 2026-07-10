import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import {
  FootballDataAdapter,
  ALLOWED_LEAGUES,
  createFootballDataAdapter,
  normalizeMatchStatus,
  resetRateLimiterForTest,
} from '../../src/adapters/football-data-adapter.js';

function mockFetch(responses) {
  const fn = jest.fn(async (url) => {
    const key = Object.keys(responses).find((k) => url.includes(k));
    const spec = responses[key];
    if (!spec) {
      return { ok: false, status: 404, text: async () => 'not found' };
    }
    if (spec.status === 429) {
      return { ok: false, status: 429, text: async () => 'rate limited' };
    }
    if (!spec.ok) {
      return { ok: false, status: spec.status ?? 500, text: async () => spec.body ?? 'error' };
    }
    return { ok: true, status: 200, json: async () => spec.body };
  });
  return fn;
}

describe('FootballDataAdapter', () => {
  beforeAll(() => {
    runMigrations();
  });

  beforeEach(() => {
    resetRateLimiterForTest();
  });

  afterAll(() => {
    closeDb();
  });

  it('exports ALLOWED_LEAGUES whitelist', () => {
    expect(ALLOWED_LEAGUES).toEqual(['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC']);
  });

  it('throws when API key is missing', async () => {
    const adapter = new FootballDataAdapter({ apiKey: '', baseUrl: 'https://api.test/v4', fetchImpl: jest.fn() });
    await expect(adapter.getCompetitionTeams('PL')).rejects.toMatchObject({ code: 'API_KEY_MISSING' });
  });

  it('throws for league not in whitelist', async () => {
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl: jest.fn() });
    await expect(adapter.getCompetitionTeams('XX')).rejects.toThrow('不在白名单');
  });

  it('maps competition teams from API response', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/teams': {
        ok: true,
        body: {
          teams: [{
            id: 57,
            name: 'Arsenal FC',
            shortName: 'Arsenal',
            tla: 'ARS',
            crest: 'https://example.com/ars.png',
          }],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const teams = await adapter.getCompetitionTeams('PL');
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ id: '57', name: 'Arsenal FC', leagueCode: 'PL' });
  });

  it('maps competition matches from API response', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/matches': {
        ok: true,
        body: {
          matches: [{
            id: 1001,
            utcDate: '2026-07-01T15:00:00.000Z',
            status: 'FINISHED',
            matchday: 10,
            season: { startDate: '2025-08-01' },
            homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: 'https://a.png' },
            awayTeam: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: 'https://c.png' },
            score: { fullTime: { home: 2, away: 1 } },
          }],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const matches = await adapter.getCompetitionMatches('PL');
    expect(matches[0]).toMatchObject({
      id: '1001',
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      dataCompleteness: 'partial',
    });
  });

  it('maps match detail with statistics and events', async () => {
    const fetchImpl = mockFetch({
      '/matches/1001': {
        ok: true,
        body: {
          id: 1001,
          competition: { code: 'PL' },
          utcDate: '2026-07-01T15:00:00.000Z',
          status: 'FINISHED',
          homeTeam: { id: 57, name: 'Arsenal FC' },
          awayTeam: { id: 61, name: 'Chelsea FC' },
          score: { fullTime: { home: 2, away: 1 } },
          statistics: [
            { team: { id: 57 }, statistics: [{ type: 'Ball Possession', value: '58%' }] },
            { team: { id: 61 }, statistics: [{ type: 'Ball Possession', value: '42%' }] },
          ],
          goals: [{ minute: 10, team: { id: 57 }, scorer: { name: 'Saka' }, type: 'REGULAR' }],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const match = await adapter.getMatch('1001');
    expect(match.statsJson.length).toBe(1);
    expect(match.eventsJson.length).toBe(1);
    expect(match.dataCompleteness).toBe('complete');
  });

  it('throws RATE_LIMITED on 429 response', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/teams': { ok: false, status: 429 },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    await expect(adapter.getCompetitionTeams('PL')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('throws on non-ok API response', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/teams': { ok: false, status: 403, body: 'forbidden' },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    await expect(adapter.getCompetitionTeams('PL')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('createFootballDataAdapter returns adapter instance', () => {
    expect(createFootballDataAdapter({ apiKey: 'k' })).toBeInstanceOf(FootballDataAdapter);
  });

  it('maps scheduled match as pending completeness', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/matches': {
        ok: true,
        body: {
          matches: [{
            id: 2001,
            utcDate: '2026-08-01T15:00:00.000Z',
            status: 'SCHEDULED',
            homeTeam: { id: 57, name: 'Arsenal FC' },
            awayTeam: { id: 61, name: 'Chelsea FC' },
          }],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const matches = await adapter.getCompetitionMatches('PL');
    expect(matches[0].dataCompleteness).toBe('pending');
    expect(matches[0].homeScore).toBeNull();
  });

  it('maps all event types including cards and substitutions', async () => {
    const fetchImpl = mockFetch({
      '/matches/2002': {
        ok: true,
        body: {
          id: 2002,
          competition: { id: 'PL' },
          utcDate: '2026-07-01T15:00:00.000Z',
          status: 'FINISHED',
          homeTeam: { id: 57, name: 'Arsenal FC' },
          awayTeam: { id: 61, name: 'Chelsea FC' },
          score: { fullTime: { home: 1, away: 0 } },
          goals: [
            { minute: 10, type: 'OWN', team: { id: 61 }, scorer: { name: 'Def' } },
            { minute: 20, type: 'PENALTY', team: { id: 57 }, scorer: { name: 'St' }, assist: { name: 'As' } },
          ],
          bookings: [
            { minute: 30, card: 'YELLOW_CARD', team: { id: 57 }, player: { name: 'P1' } },
            { minute: 40, card: 'RED_CARD', team: { id: 61 }, player: { name: 'P2' } },
          ],
          substitutions: [
            { minute: 70, team: { id: 57 }, playerOut: { name: 'Out' }, playerIn: { name: 'In' } },
          ],
          statistics: [
            { statistics: [{ type: 'Ball Possession', value: '55%' }] },
            { statistics: [{ type: 'Ball Possession', value: '45%' }] },
          ],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const match = await adapter.getMatch('2002');
    expect(match.eventsJson.map((e) => e.type)).toEqual(
      expect.arrayContaining(['OWN_GOAL', 'PENALTY', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION']),
    );
    expect(match.statsJson[0].unit).toBe('%');
  });

  it('handles invalid stat values and missing away stat pairs', async () => {
    const fetchImpl = mockFetch({
      '/matches/2003': {
        ok: true,
        body: {
          id: 2003,
          competition: { code: 'PL' },
          utcDate: '2026-07-01T15:00:00.000Z',
          status: 'FINISHED',
          homeTeam: { id: 57, name: 'Arsenal FC' },
          awayTeam: { id: 61, name: 'Chelsea FC' },
          score: { fullTime: { home: 1, away: 0 } },
          statistics: [
            { statistics: [{ type: 'unknown percentage', value: 'bad' }, { type: 'Solo', value: 3 }] },
            { statistics: [{ type: 'Solo', value: 1 }] },
          ],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const match = await adapter.getMatch('2003');
    expect(match.statsJson.length).toBeGreaterThanOrEqual(1);
  });

  it('marks finished match without any data as pending completeness', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/matches': {
        ok: true,
        body: {
          matches: [{
            id: 2004,
            utcDate: '2026-07-01T15:00:00.000Z',
            status: 'FINISHED',
            homeTeam: { id: 57, name: 'Arsenal FC' },
            awayTeam: { id: 61, name: 'Chelsea FC' },
          }],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const matches = await adapter.getCompetitionMatches('PL');
    expect(matches[0].dataCompleteness).toBe('pending');
  });

  it('supports status filter on competition matches', async () => {
    const fetchImpl = mockFetch({
      '/competitions/PL/matches?status=FINISHED': {
        ok: true,
        body: { matches: [] },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const matches = await adapter.getCompetitionMatches('PL', { status: 'FINISHED' });
    expect(matches).toEqual([]);
  });

  it('appends season query for World Cup competitions', async () => {
    const fetchImpl = jest.fn(async (url) => {
      expect(url).toContain('/competitions/WC/matches?season=');
      return {
        ok: true,
        status: 200,
        json: async () => ({ matches: [] }),
      };
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    await adapter.getCompetitionMatches('WC');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('normalizes football-data TIMED status to SCHEDULED', () => {
    expect(normalizeMatchStatus('TIMED')).toBe('SCHEDULED');
    expect(normalizeMatchStatus('IN_PLAY')).toBe('LIVE');
    expect(normalizeMatchStatus('FINISHED')).toBe('FINISHED');
  });

  it('maps World Cup TIMED matches without CHECK constraint errors', async () => {
    const fetchImpl = mockFetch({
      '/competitions/WC/matches?season=2026': {
        ok: true,
        body: {
          matches: [{
            id: 3001,
            utcDate: '2026-07-15T18:00:00.000Z',
            status: 'TIMED',
            homeTeam: { id: 1, name: 'Mexico' },
            awayTeam: { id: 2, name: 'South Africa' },
          }],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const matches = await adapter.getCompetitionMatches('WC', { season: 2026 });
    expect(matches[0]).toMatchObject({ id: '3001', status: 'SCHEDULED', leagueCode: 'WC' });
  });

  it('skips knockout placeholder matches without both teams', async () => {
    const fetchImpl = mockFetch({
      '/competitions/WC/matches?season=2026': {
        ok: true,
        body: {
          matches: [
            {
              id: 3002,
              utcDate: '2026-07-20T18:00:00.000Z',
              status: 'TIMED',
              homeTeam: { id: 1, name: 'Mexico' },
              awayTeam: { id: 2, name: 'South Africa' },
            },
            {
              id: 3003,
              utcDate: '2026-07-21T18:00:00.000Z',
              status: 'TIMED',
              homeTeam: null,
              awayTeam: null,
            },
          ],
        },
      },
    });
    const adapter = new FootballDataAdapter({ apiKey: 'key', baseUrl: 'https://api.test/v4', fetchImpl });
    const matches = await adapter.getCompetitionMatches('WC', { season: 2026 });
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('3002');
  });
});
