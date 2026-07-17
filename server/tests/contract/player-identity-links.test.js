import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createApp } from '../../src/app.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';
import { createActiveLink, updateLinkStatus } from '../../src/db/repositories/player-identity-link-repository.js';

const CAREER_LINKED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
const CAREER_UNLINKED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';
const CAREER_PENDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03';

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

  db.prepare(`
    INSERT OR REPLACE INTO players (
      id, name, team_id, position, date_of_birth, nationality, league_code, updated_at,
      transfermarkt_id
    ) VALUES ('contract-stats-pending', 'Pending Match', 'team-contract-align', 'Midfielder',
      '1996-01-01', 'Spain', 'PL', ?, 'contract-tm-pending')
  `).run(now);

  upsertCareerPlayer({
    id: CAREER_LINKED,
    externalSource: 'transfermarkt',
    externalId: 'contract-tm-1',
    name: 'Contract Match',
    nameNormalized: 'contract match',
    syncedAt: now,
    syncStatus: 'ready',
  });

  upsertCareerPlayer({
    id: CAREER_UNLINKED,
    externalSource: 'transfermarkt',
    externalId: 'contract-tm-unlinked',
    name: 'Unlinked Career',
    nameNormalized: 'unlinked career',
    syncedAt: now,
    syncStatus: 'ready',
  });

  upsertCareerPlayer({
    id: CAREER_PENDING,
    externalSource: 'transfermarkt',
    externalId: 'contract-tm-pending',
    name: 'Pending Career',
    nameNormalized: 'pending career',
    syncedAt: now,
    syncStatus: 'ready',
  });

  createActiveLink({
    statsPlayerId: 'contract-stats-1',
    careerPlayerId: CAREER_LINKED,
    matchKey: 'contract-tm-1',
    confidence: 'high',
  });

  const pending = createActiveLink({
    statsPlayerId: 'contract-stats-pending',
    careerPlayerId: CAREER_PENDING,
    matchKey: 'contract-tm-pending',
    confidence: 'high',
  });
  updateLinkStatus(pending.id, { confidence: 'medium', status: 'active' });
}

describe('Player identity links API contract', () => {
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

  describe('GET /api/player-identity-links?careerPlayerIds=', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .get(`/api/player-identity-links?careerPlayerIds=${CAREER_LINKED}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns linked / unlinked / pending_confirmation without fabricating statsPlayerId', async () => {
      const res = await request(app)
        .get(`/api/player-identity-links?careerPlayerIds=${CAREER_LINKED},${CAREER_UNLINKED},${CAREER_PENDING}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);

      const byId = Object.fromEntries(res.body.items.map((i) => [i.careerPlayerId, i]));

      expect(byId[CAREER_LINKED]).toMatchObject({
        linkState: 'linked',
        statsPlayerId: 'contract-stats-1',
        statsEntryPath: '/players/contract-stats-1',
      });
      expect(byId[CAREER_LINKED].link).toMatchObject({
        careerPlayerId: CAREER_LINKED,
        confidence: 'high',
        status: 'active',
      });

      expect(byId[CAREER_UNLINKED]).toMatchObject({
        linkState: 'unlinked',
        statsPlayerId: null,
        statsEntryPath: null,
        link: null,
      });

      expect(byId[CAREER_PENDING]).toMatchObject({
        linkState: 'pending_confirmation',
        statsPlayerId: 'contract-stats-pending',
        statsEntryPath: '/players/contract-stats-pending',
      });
      expect(byId[CAREER_PENDING].link.confidence).not.toBe('high');
    });

    it('returns 400 when careerPlayerIds missing', async () => {
      const res = await request(app)
        .get('/api/player-identity-links')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });
  });

  describe('GET /api/player-identity-links/resolve', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .get('/api/player-identity-links/resolve?statsPlayerId=contract-stats-1');
      expect(res.status).toBe(401);
    });

    it('resolves by statsPlayerId', async () => {
      const res = await request(app)
        .get('/api/player-identity-links/resolve?statsPlayerId=contract-stats-1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        statsPlayerId: 'contract-stats-1',
        careerPlayerId: CAREER_LINKED,
        confidence: 'high',
        matchBasis: 'transfermarkt_id',
        status: 'active',
      });
    });

    it('resolves by careerPlayerId', async () => {
      const res = await request(app)
        .get(`/api/player-identity-links/resolve?careerPlayerId=${CAREER_LINKED}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.statsPlayerId).toBe('contract-stats-1');
    });

    it('returns 404 when not found', async () => {
      const res = await request(app)
        .get(`/api/player-identity-links/resolve?careerPlayerId=${CAREER_UNLINKED}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 400 when both params provided', async () => {
      const res = await request(app)
        .get(`/api/player-identity-links/resolve?statsPlayerId=contract-stats-1&careerPlayerId=${CAREER_LINKED}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });

    it('returns 400 when neither param provided', async () => {
      const res = await request(app)
        .get('/api/player-identity-links/resolve')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });
});
