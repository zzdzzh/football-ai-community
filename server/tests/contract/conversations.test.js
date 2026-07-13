import { jest } from '@jest/globals';
import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { seedTeamsAndMatches, registerAndLogin } from '../helpers/seed-match-data.js';

const mockAnalyze = jest.fn().mockResolvedValue({
  interpretation: '阿森纳控球率更高，射门也更多。',
  metrics: [
    { name: '控球率', value: 58, unit: '%' },
    { name: '射门', value: 14 },
    { name: '射正', value: 6 },
  ],
  confidence: 'high',
  missingFields: [],
});

jest.unstable_mockModule('../../src/ai/ai-analysis-service.js', () => ({
  createAiAnalysisService: () => ({
    analyze: mockAnalyze,
  }),
  AiAnalysisService: class {},
}));

const { createApp } = await import('../../src/app.js');

describe('Conversations API contract', () => {
  let app;
  let token;
  let matchId;
  let otherToken;

  beforeAll(async () => {
    runMigrations();
    app = createApp();
    ({ matchId } = seedTeamsAndMatches());
    ({ token } = await registerAndLogin(app, request));
    ({ token: otherToken } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  describe('POST /api/conversations', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/conversations').send({
        agentId: 'stats',
        contextType: 'match',
        contextId: matchId,
      });
      expect(res.status).toBe(401);
    });

    it('returns 201 when creating match conversation', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'stats',
          contextType: 'match',
          contextId: matchId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        agentId: 'stats',
        contextType: 'match',
        contextId: matchId,
        title: expect.stringContaining('数据问答'),
        messages: expect.any(Array),
      });
    });

    it('returns 404 when match context not found', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'stats',
          contextType: 'match',
          contextId: 'unknown-match',
        });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/conversations', () => {
    it('returns 200 with user conversation list', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/conversations/:conversationId', () => {
    it('returns 403 for non-owner', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ agentId: 'stats', contextType: 'general' });

      const res = await request(app)
        .get(`/api/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/conversations/:conversationId/messages', () => {
    it('returns assistant reply with metrics and confidence', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ agentId: 'stats', contextType: 'match', contextId: matchId });

      const res = await request(app)
        .post(`/api/conversations/${createRes.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '这场比赛控球与射门表现如何？' });

      expect(res.status).toBe(200);
      expect(res.body.userMessage.role).toBe('user');
      expect(res.body.assistantMessage.role).toBe('assistant');
      expect(res.body.assistantMessage.metrics.length).toBeGreaterThanOrEqual(3);
      expect(res.body.assistantMessage.confidence).toBeDefined();
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('returns 503 when data is pending sync', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO matches (
          id, league_code, utc_date, status, home_team_id, away_team_id,
          data_completeness, last_synced_at, created_at, updated_at
        ) VALUES ('pending-match', 'PL', ?, 'SCHEDULED', '57', '61', 'pending', ?, ?, ?)
      `).run(now, now, now, now);

      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ agentId: 'stats', contextType: 'match', contextId: 'pending-match' });

      const res = await request(app)
        .post(`/api/conversations/${createRes.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '预测一下？' });

      expect(res.status).toBe(503);
    });
  });

  describe('MVP-4 scope boundary audit', () => {
    it('rejects fan agentId on conversations API', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'fan',
          contextType: 'general',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });

    it('does not expose direct messaging or chat room routes', async () => {
      const directRes = await request(app)
        .post('/api/messages/direct')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'hello' });
      const roomRes = await request(app)
        .get('/api/chat-rooms')
        .set('Authorization', `Bearer ${token}`);

      expect(directRes.status).toBe(404);
      expect(roomRes.status).toBe(404);
    });
  });
});
