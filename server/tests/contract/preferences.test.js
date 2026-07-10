import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';

describe('Preferences API contract', () => {
  let app;
  let token;

  const testUser = {
    email: 'prefs-test@example.com',
    password: 'password123',
    nickname: '偏好测试',
  };

  beforeAll(async () => {
    runMigrations();
    app = createApp();

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    token = registerRes.body.token;
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/users/me/preferences', () => {
    it('returns 200 with default preferences when authenticated', async () => {
      const res = await request(app)
        .get('/api/users/me/preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.followedTeams).toEqual([]);
      expect(res.body.followedLeagues).toEqual([]);
      expect(res.body.enabledAgents).toEqual(
        expect.arrayContaining(['news', 'stats', 'scout', 'tactical', 'fan', 'content']),
      );
      expect(res.body.notifyMatchReport).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/me/preferences');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });

  describe('PUT /api/users/me/preferences', () => {
    it('returns 200 with updated preferences', async () => {
      const payload = {
        followedTeams: ['Arsenal', '皇马'],
        followedLeagues: ['PL', 'PD'],
        enabledAgents: ['news', 'content'],
        notifyMatchReport: false,
      };

      const res = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.followedTeams).toEqual(payload.followedTeams);
      expect(res.body.followedLeagues).toEqual(payload.followedLeagues);
      expect(res.body.enabledAgents).toEqual(payload.enabledAgents);
      expect(res.body.notifyMatchReport).toBe(false);
    });

    it('returns 400 for invalid leagues', async () => {
      const res = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ followedLeagues: ['INVALID'] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .put('/api/users/me/preferences')
        .send({ followedTeams: ['Liverpool'] });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });
});
