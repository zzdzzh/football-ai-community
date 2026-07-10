import { jest } from '@jest/globals';
import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { seedTacticalMatches } from '../helpers/seed-tactical-data.js';

const mockAnalyze = jest.fn().mockResolvedValue({
  summary: '主队通过高位压迫限制客队出球，转换阶段效率较高。',
  formation: '4-3-3',
  phases: [
    {
      key: 'pressing',
      label: '高位压迫',
      summary: '前场三人组协同压迫，迫使客队长传。',
      keyPlayerNames: ['Saka'],
    },
    {
      key: 'build_up',
      label: '出球组织',
      summary: '后场出球以短传为主，边后卫前插参与。',
      keyPlayerNames: [],
    },
    {
      key: 'transition',
      label: '攻守转换',
      summary: '夺回球权后快速向前传递，利用边路速度。',
      keyPlayerNames: ['Saka'],
    },
  ],
  keyPlayers: [
    { name: 'Saka', role: '右路进攻核心' },
    { name: 'Palmer', role: '客队反击发起点' },
  ],
  confidence: 'high',
  dataLimitations: [],
});

jest.unstable_mockModule('../../src/ai/ai-tactical-service.js', () => ({
  createAiTacticalService: () => ({
    analyze: mockAnalyze,
  }),
  AiTacticalService: class {},
}));

const { createApp } = await import('../../src/app.js');

describe('Tactical conversations API contract', () => {
  let app;
  let token;
  let otherToken;
  let matchIds;

  beforeAll(async () => {
    runMigrations();
    matchIds = seedTacticalMatches();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
    ({ token: otherToken } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  describe('POST /api/conversations (tactical)', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/conversations').send({
        agentId: 'tactical',
        contextType: 'match',
        contextId: matchIds.matchId,
      });
      expect(res.status).toBe(401);
    });

    it('returns 201 when creating match tactical conversation', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'tactical',
          contextType: 'match',
          contextId: matchIds.matchId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        agentId: 'tactical',
        contextType: 'match',
        contextId: matchIds.matchId,
        title: expect.stringContaining('战术分析'),
        messages: expect.any(Array),
      });
    });

    it('returns 404 for missing match', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'tactical',
          contextType: 'match',
          contextId: 'missing-match',
        });
      expect(res.status).toBe(404);
    });

    it('returns 400 for unsupported context type', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'tactical',
          contextType: 'league',
          contextId: 'PL',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/conversations?agentId=tactical', () => {
    it('returns tactical conversation list', async () => {
      const res = await request(app)
        .get('/api/conversations?agentId=tactical')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0].agentId).toBe('tactical');
    });
  });

  describe('POST /api/conversations/:id/messages (tactical)', () => {
    it('returns tactical analysis with formation and phases', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'tactical',
          contextType: 'match',
          contextId: matchIds.matchId,
        });

      const res = await request(app)
        .post(`/api/conversations/${createRes.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '主队是如何组织高位压迫的？' });

      expect(res.status).toBe(200);
      expect(res.body.assistantMessage.content).toContain('【赛后复盘】');
      expect(res.body.assistantMessage.tacticalAnalysis).toMatchObject({
        analysisType: 'post_match',
        formation: expect.any(String),
        phases: expect.arrayContaining([
          expect.objectContaining({ key: 'pressing', summary: expect.any(String) }),
        ]),
      });
      expect(res.body.assistantMessage.tacticalAnalysis.phases.length).toBeGreaterThanOrEqual(1);
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('labels scheduled match as pre-match prediction', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'tactical',
          contextType: 'match',
          contextId: matchIds.scheduledMatchId,
          initialMessage: '客队可能采用什么压迫战术？',
        });

      const detail = await request(app)
        .get(`/api/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      const assistantMsg = detail.body.messages.find((m) => m.role === 'assistant');
      expect(assistantMsg.content).toContain('【赛前战术预判】');
      expect(assistantMsg.tacticalAnalysis.analysisType).toBe('pre_match_prediction');
    });
  });

  describe('POST /api/conversations/:id/messages/:messageId/feedback', () => {
    it('records helpful feedback for tactical assistant message', async () => {
      const createRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: 'tactical',
          contextType: 'match',
          contextId: matchIds.matchId,
          initialMessage: '分析压迫战术',
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
      expect(res.body.helpful).toBe(true);
    });
  });
});
