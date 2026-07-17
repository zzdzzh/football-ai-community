import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createApp } from '../../src/app.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';

function seedAlignFixture() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO teams (id, name, league_code, updated_at)
    VALUES ('team-contract-align', 'Contract Align FC', 'PL', ?)
  `).run(now);

  db.prepare(`
    INSERT OR REPLACE INTO players (
      id, name, team_id, position, date_of_birth, nationality, league_code, updated_at,
      transfermarkt_id
    ) VALUES ('contract-stats-1', 'Contract Match', 'team-contract-align', 'Forward',
      '1995-01-01', 'Spain', 'PL', ?, 'contract-tm-1')
  `).run(now);

  upsertCareerPlayer({
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
    externalSource: 'transfermarkt',
    externalId: 'contract-tm-1',
    name: 'Contract Match',
    nameNormalized: 'contract match',
    syncedAt: now,
    syncStatus: 'ready',
  });
}

describe('Player identity links API contract (US1 align)', () => {
  let app;
  let token;

  beforeAll(async () => {
    runMigrations();
    seedAlignFixture();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  describe('POST /api/player-identity-links/align', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/player-identity-links/align');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 200 with created/conflict/skipped counters when authenticated', async () => {
      const res = await request(app)
        .post('/api/player-identity-links/align')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        runId: expect.any(String),
        created: expect.any(Number),
        conflict: expect.any(Number),
        skipped: expect.any(Number),
        finishedAt: expect.any(String),
      });
      expect(res.body.created).toBeGreaterThanOrEqual(0);
      expect(res.body.conflict).toBeGreaterThanOrEqual(0);
      expect(res.body.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/internal/player-identity-align', () => {
    it('returns 401 when internal key is missing or invalid', async () => {
      const res = await request(app).post('/api/internal/player-identity-align');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 200 or 202 with align counters when internal key is valid', async () => {
      const res = await request(app)
        .post('/api/internal/player-identity-align')
        .set('X-Internal-Key', 'dev-internal-key');

      expect([200, 202]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toMatchObject({
          runId: expect.any(String),
          created: expect.any(Number),
          conflict: expect.any(Number),
          skipped: expect.any(Number),
          finishedAt: expect.any(String),
        });
      } else {
        expect(res.body).toMatchObject({
          accepted: true,
        });
      }
    });
  });
});
