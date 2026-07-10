import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { seedTeamsAndMatches } from '../helpers/seed-match-data.js';

describe('Teams API contract', () => {
  let app;
  let homeTeamId;

  beforeAll(() => {
    runMigrations();
    app = createApp();
    ({ homeTeamId } = seedTeamsAndMatches());
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/teams', () => {
    it('returns 200 with paginated team list', async () => {
      const res = await request(app).get('/api/teams?q=Arsenal');

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      const team = res.body.items[0];
      expect(team).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        leagueCode: 'PL',
      });
    });

    it('filters by league', async () => {
      const res = await request(app).get('/api/teams?league=PL');
      expect(res.status).toBe(200);
      expect(res.body.items.every((t) => t.leagueCode === 'PL')).toBe(true);
    });
  });

  describe('GET /api/teams/:teamId', () => {
    it('returns 200 with team detail and recent matches', async () => {
      const res = await request(app).get(`/api/teams/${homeTeamId}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: homeTeamId,
        name: 'Arsenal FC',
        leagueCode: 'PL',
      });
      expect(res.body.recentMatches).toEqual(expect.any(Array));
      expect(res.body.recentMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for unknown team', async () => {
      const res = await request(app).get('/api/teams/unknown-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
