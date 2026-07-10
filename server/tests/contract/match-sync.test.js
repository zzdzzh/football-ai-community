import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';

describe('Match sync internal job contract', () => {
  let app;

  beforeAll(() => {
    runMigrations();
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  describe('POST /api/internal/jobs/match-sync', () => {
    it('returns 202 when internal key is valid', async () => {
      const res = await request(app)
        .post('/api/internal/jobs/match-sync')
        .set('X-Internal-Key', 'dev-internal-key');

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        jobId: expect.any(String),
        status: 'accepted',
      });
    });

    it('returns 401 when internal key is missing or invalid', async () => {
      const res = await request(app).post('/api/internal/jobs/match-sync');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 400 for invalid league query', async () => {
      const res = await request(app)
        .post('/api/internal/jobs/match-sync?league=INVALID')
        .set('X-Internal-Key', 'dev-internal-key');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });
  });
});
