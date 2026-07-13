import { jest } from '@jest/globals';
import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { seedFanPersonas } from '../helpers/seed-fan-data.js';

const mockSimulateTurns = jest.fn().mockResolvedValue({
  turns: [
    { personaId: 'persona-arsenal', content: '观点A' },
    { personaId: 'persona-liverpool', content: '观点B' },
    { personaId: 'persona-arsenal', content: '观点C' },
    { personaId: 'persona-liverpool', content: '观点D' },
  ],
  disclaimer: '模拟内容仅供娱乐，不代表真实球迷或俱乐部立场',
});

jest.unstable_mockModule('../../src/ai/ai-fan-service.js', () => ({
  createAiFanService: () => ({
    simulateTurns: mockSimulateTurns,
  }),
  AiFanService: class {},
}));

const { createApp } = await import('../../src/app.js');

describe('Content reports API contract', () => {
  let app;
  let token;
  let discussionId;
  let turnId;

  beforeAll(async () => {
    runMigrations();
    const { personaIds } = seedFanPersonas();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));

    const created = await request(app)
      .post('/api/fan-discussions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        topic: '举报测试讨论',
        personaIds,
      });
    discussionId = created.body.id;
    turnId = created.body.turns[0].id;
  });

  afterAll(() => {
    closeDb();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/content-reports').send({
      targetType: 'fan_discussion_turn',
      targetId: turnId,
      reason: '不当言论',
    });
    expect(res.status).toBe(401);
  });

  it('returns 201 when report is submitted', async () => {
    const res = await request(app)
      .post('/api/content-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'fan_discussion_turn',
        targetId: turnId,
        reason: '涉嫌人身攻击',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      targetType: 'fan_discussion_turn',
      targetId: turnId,
      reason: '涉嫌人身攻击',
      status: 'pending',
      reporterUserId: expect.any(String),
    });
  });

  it('returns 409 for duplicate report within 24h', async () => {
    const res = await request(app)
      .post('/api/content-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'fan_discussion_turn',
        targetId: turnId,
        reason: '再次举报',
      });
    expect(res.status).toBe(409);
  });

  it('returns 404 when target does not exist', async () => {
    const res = await request(app)
      .post('/api/content-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'fan_discussion',
        targetId: '00000000-0000-0000-0000-000000000000',
        reason: '不存在',
      });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid target type', async () => {
    const res = await request(app)
      .post('/api/content-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'invalid',
        targetId: discussionId,
        reason: 'bad type',
      });
    expect(res.status).toBe(400);
  });
});
