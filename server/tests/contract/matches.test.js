import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { seedTeamsAndMatches } from '../helpers/seed-match-data.js';

describe('Matches API contract', () => {
  let app;
  let matchId;

  beforeAll(() => {
    runMigrations();
    app = createApp();
    ({ matchId } = seedTeamsAndMatches());
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/matches', () => {
    it('returns 200 with paginated match list', async () => {
      const res = await request(app).get('/api/matches');

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.syncStatus).toMatch(/ok|degraded|down/);
      expect(res.body.warnings).toEqual(expect.any(Array));

      const first = res.body.items[0];
      expect(first).toMatchObject({
        id: expect.any(String),
        leagueCode: 'PL',
        utcDate: expect.any(String),
        status: 'FINISHED',
        homeTeam: expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
        awayTeam: expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
        dataCompleteness: expect.any(String),
      });
    });

    it('filters by league and status', async () => {
      const res = await request(app).get('/api/matches?league=PL&status=FINISHED');
      expect(res.status).toBe(200);
      expect(res.body.items.every((m) => m.leagueCode === 'PL' && m.status === 'FINISHED')).toBe(true);
    });
  });

  describe('GET /api/matches/:matchId', () => {
    it('returns 200 with match detail including stats and events', async () => {
      const res = await request(app).get(`/api/matches/${matchId}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: matchId,
        leagueCode: 'PL',
        status: 'FINISHED',
        homeScore: 2,
        awayScore: 1,
        dataCompleteness: 'complete',
      });
      expect(res.body.stats.length).toBeGreaterThanOrEqual(3);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for unknown match', async () => {
      const res = await request(app).get('/api/matches/unknown-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
