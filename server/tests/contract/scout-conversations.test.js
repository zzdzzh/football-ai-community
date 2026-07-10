import { jest } from '@jest/globals';
import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { seedScoutPlayers } from '../helpers/seed-scout-data.js';

const mockRecommend = jest.fn().mockResolvedValue({
  summary: '以下是符合压迫型中场条件的推荐球员。',
  recommendations: [
    {
      playerId: 'p2',
      matchReason: '组织核心，压迫积极',
      keyStats: [
        { name: '进球', value: 5 },
        { name: '助攻', value: 8 },
        { name: '出场', value: 28 },
      ],
    },
    {
      playerId: 'p3',
      matchReason: '防守覆盖面积大',
      keyStats: [
        { name: '进球', value: 3 },
        { name: '助攻', value: 4 },
        { name: '出场', value: 32 },
      ],
    },
    {
      playerId: 'p4',
      matchReason: '年轻有潜力的攻击型中场',
      keyStats: [
        { name: '进球', value: 12 },
        { name: '助攻', value: 6 },
        { name: '点球', value: 2 },
      ],
    },
  ],
  narrowHint: null,
  confidence: 'high',
});

jest.unstable_mockModule('../../src/ai/ai-scout-service.js', () => ({
  createAiScoutService: () => ({
    recommend: mockRecommend,
  }),
  AiScoutService: class {},
}));

const { createApp } = await import('../../src/app.js');

describe('Scout conversations API contract', () => {
  let app;
  let token;
  let otherToken;

  beforeAll(async () => {
    runMigrations();
    seedScoutPlayers();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
    ({ token: otherToken } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  describe('POST /api/conversations (scout)', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/conversations').send({
        agentId: 'scout',
        contextType: 'league',
        contextId: 'PL',
      });
      expect(res.status).toBe(401);
    });

    it('returns 201 when creating league scout conversation', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'scout',
          contextType: 'league',
          contextId: 'PL',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        agentId: 'scout',
        contextType: 'league',
        contextId: 'PL',
        title: expect.stringContaining('球员推荐'),
        messages: expect.any(Array),
      });
    });

    it('returns 404 for invalid league', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'scout',
          contextType: 'league',
          contextId: 'INVALID',
        });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/conversations?agentId=scout', () => {
    it('returns scout conversation list', async () => {
      const res = await request(app)
        .get('/api/conversations?agentId=scout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0].agentId).toBe('scout');
    });
  });

  describe('POST /api/conversations/:id/messages (scout)', () => {
    it('returns recommendations with at least 3 players and keyStats', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'scout',
          contextType: 'league',
          contextId: 'PL',
        });

      const res = await request(app)
        .post(`/api/conversations/${createRes.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '需要一名擅长压迫的中场，25岁以下' });

      expect(res.status).toBe(200);
      expect(res.body.assistantMessage.recommendations.length).toBeGreaterThanOrEqual(3);
      for (const rec of res.body.assistantMessage.recommendations) {
        expect(rec.keyStats.length).toBeGreaterThanOrEqual(3);
        expect(rec.playerName).toBeDefined();
        expect(rec.teamName).toBeDefined();
      }
      expect(mockRecommend).toHaveBeenCalled();
    });
  });

  describe('POST /api/conversations/:id/messages/:messageId/feedback', () => {
    it('records helpful feedback for scout assistant message', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'scout',
          contextType: 'league',
          contextId: 'PL',
          initialMessage: '推荐年轻中场',
        });

      const detail = await request(app)
        .get(`/api/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const assistantMsg = detail.body.messages.find((m) => m.role === 'assistant');
      const res = await request(app)
        .post(`/api/conversations/${createRes.body.id}/messages/${assistantMsg.id}/feedback`)
        .set('Authorization', `Bearer ${token}`)
        .send({ helpful: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        messageId: assistantMsg.id,
        helpful: true,
        recordedAt: expect.any(String),
      });
    });

    it('returns 403 for non-owner', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'scout',
          contextType: 'general',
          initialMessage: '推荐球员',
        });

      const detail = await request(app)
        .get(`/api/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const assistantMsg = detail.body.messages.find((m) => m.role === 'assistant');
      const res = await request(app)
        .post(`/api/conversations/${createRes.body.id}/messages/${assistantMsg.id}/feedback`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ helpful: false });

      expect(res.status).toBe(403);
    });
  });
});
