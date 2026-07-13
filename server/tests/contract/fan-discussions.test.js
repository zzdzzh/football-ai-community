import { jest } from '@jest/globals';
import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { seedFanPersonas } from '../helpers/seed-fan-data.js';

const mockSimulateTurns = jest.fn();

jest.unstable_mockModule('../../src/ai/ai-fan-service.js', () => ({
  createAiFanService: () => ({
    simulateTurns: mockSimulateTurns,
  }),
  AiFanService: class {},
}));

const { createApp } = await import('../../src/app.js');

function mockInitialTurns() {
  return [
    { personaId: 'persona-arsenal', content: '阿森纳这场控球率更高' },
    { personaId: 'persona-liverpool', content: '利物浦反击更犀利' },
    { personaId: 'persona-arsenal', content: '萨卡是关键' },
    { personaId: 'persona-liverpool', content: '萨拉赫威胁仍在' },
  ];
}

describe('Fan discussions API contract', () => {
  let app;
  let token;
  let otherToken;
  let personaIds;

  beforeAll(async () => {
    runMigrations();
    ({ personaIds } = seedFanPersonas());
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
    ({ token: otherToken } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    mockSimulateTurns.mockReset();
    mockSimulateTurns.mockResolvedValue({
      turns: mockInitialTurns(),
      disclaimer: '模拟内容仅供娱乐，不代表真实球迷或俱乐部立场',
    });
  });

  describe('GET /api/fan-personas', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/fan-personas');
      expect(res.status).toBe(401);
    });

    it('returns 200 with persona list', async () => {
      const res = await request(app)
        .get('/api/fan-personas?league=PL')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.items[0]).toMatchObject({
        id: expect.any(String),
        displayName: expect.any(String),
        teamId: expect.any(String),
        teamName: expect.any(String),
        leagueCode: 'PL',
        styleTraits: expect.any(Array),
      });
    });
  });

  describe('POST /api/fan-discussions', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/fan-discussions').send({
        topic: '赛后讨论',
        personaIds,
      });
      expect(res.status).toBe(401);
    });

    it('returns 201 with at least 4 persona turns', async () => {
      const res = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          topic: '阿森纳 vs 利物浦谁更强',
          personaIds,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        topic: '阿森纳 vs 利物浦谁更强',
        status: 'active',
        turnCount: 4,
        disclaimer: expect.any(String),
      });
      expect(res.body.personas.length).toBe(2);
      expect(res.body.turns.filter((turn) => turn.role === 'persona').length).toBeGreaterThanOrEqual(4);
      expect(res.body.turns[0]).toMatchObject({
        personaDisplayName: expect.any(String),
        teamName: expect.any(String),
      });
    });

    it('returns 400 when fewer than 2 personas', async () => {
      const res = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          topic: 'test',
          personaIds: [personaIds[0]],
        });
      expect(res.status).toBe(400);
    });

    it('returns 422 when AI output violates moderation', async () => {
      mockSimulateTurns.mockResolvedValueOnce({
        turns: [{ personaId: 'persona-arsenal', content: '官方宣布转会完成' }],
      });

      const res = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          topic: 'test',
          personaIds,
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('content_policy_violation');
    });
  });

  describe('GET /api/fan-discussions/{discussionId}', () => {
    it('returns 200 for active discussion', async () => {
      const created = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: '可读讨论', personaIds });

      const res = await request(app)
        .get(`/api/fan-discussions/${created.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.turns.length).toBeGreaterThanOrEqual(4);
    });

    it('returns 404 for unknown discussion', async () => {
      const res = await request(app)
        .get('/api/fan-discussions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/fan-discussions/{discussionId}/turns', () => {
    it('returns 403 when non-owner inserts turn', async () => {
      const created = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: '插话权限', personaIds });

      const res = await request(app)
        .post(`/api/fan-discussions/${created.body.id}/turns`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: '我觉得利物浦更强' });

      expect(res.status).toBe(403);
    });

    it('returns 200 with user turn and persona responses', async () => {
      mockSimulateTurns
        .mockResolvedValueOnce({ turns: mockInitialTurns(), disclaimer: 'disclaimer' })
        .mockResolvedValueOnce({
          turns: [{ personaId: 'persona-liverpool', content: '我不同意，利物浦更有韧性' }],
        });

      const created = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: '插话测试', personaIds });

      const res = await request(app)
        .post(`/api/fan-discussions/${created.body.id}/turns`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '我觉得阿森纳更强' });

      expect(res.status).toBe(200);
      expect(res.body.userTurn).toMatchObject({
        role: 'user',
        content: '我觉得阿森纳更强',
      });
      expect(res.body.personaTurns.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 422 when user content violates moderation', async () => {
      const created = await request(app)
        .post('/api/fan-discussions')
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: '违规插话', personaIds });

      const res = await request(app)
        .post(`/api/fan-discussions/${created.body.id}/turns`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '你去死吧' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('content_policy_violation');
    });
  });
});
