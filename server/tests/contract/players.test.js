import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createApp } from '../../src/app.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';

function seedPlayers() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
    VALUES ('57', 'Arsenal FC', 'PL', ?), ('61', 'Chelsea FC', 'PL', ?)
  `).run(now, now);
  db.prepare(`
    INSERT OR REPLACE INTO players (
      id, name, team_id, position, date_of_birth, nationality, league_code, updated_at
    ) VALUES
      ('p1', 'Bukayo Saka', '57', 'Right Winger', '2001-09-05', 'England', 'PL', ?),
      ('p2', 'Martin Ødegaard', '57', 'Central Midfield', '1998-12-17', 'Norway', 'PL', ?),
      ('p3', 'Cole Palmer', '61', 'Attacking Midfield', '2002-05-06', 'England', 'PL', ?)
  `).run(now, now, now);
  db.prepare(`
    INSERT OR REPLACE INTO player_stats_snapshots (
      id, player_id, league_code, season, goals, assists, penalties, appearances, synced_at
    ) VALUES
      ('s1', 'p1', 'PL', '2026', 10, 5, 0, 30, ?),
      ('s2', 'p2', 'PL', '2026', 5, 8, 0, 28, ?)
  `).run(now, now);
}

describe('Players API contract', () => {
  let app;
  let token;

  beforeAll(async () => {
    runMigrations();
    seedPlayers();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/players', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/players');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 200 with paginated player list', async () => {
      const res = await request(app)
        .get('/api/players?league=PL&page=1&pageSize=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        items: expect.any(Array),
        page: 1,
        pageSize: 20,
        total: expect.any(Number),
        syncStatus: expect.stringMatching(/^(ok|degraded|down)$/),
      });
      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.items[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        teamId: expect.any(String),
        teamName: expect.any(String),
        leagueCode: 'PL',
      });
    });

    it('filters by position query', async () => {
      const res = await request(app)
        .get('/api/players?league=PL&position=Midfield')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.every((p) => p.position?.includes('Midfield'))).toBe(true);
    });

    it('filters by name search', async () => {
      const res = await request(app)
        .get('/api/players?q=Saka')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.some((p) => p.name.includes('Saka'))).toBe(true);
    });
  });

  describe('GET /api/players/:playerId', () => {
    it('returns 200 with player detail and stats', async () => {
      const res = await request(app)
        .get('/api/players/p1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'p1',
        name: 'Bukayo Saka',
        teamId: '57',
        teamName: 'Arsenal FC',
        leagueCode: 'PL',
        stats: expect.any(Array),
      });
      expect(res.body.stats.length).toBeGreaterThanOrEqual(3);
    });

    it('returns 404 for unknown player', async () => {
      const res = await request(app)
        .get('/api/players/unknown-player')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
