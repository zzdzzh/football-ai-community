import { jest } from '@jest/globals';
import request from 'supertest';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { registerModerator, seedFanPersonas } from '../helpers/seed-fan-data.js';

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

describe('Admin reports API contract', () => {
  let app;
  let userToken;
  let modToken;
  let discussionId;
  let reportId;

  beforeAll(async () => {
    runMigrations();
    const { personaIds } = seedFanPersonas();
    app = createApp();
    ({ token: userToken } = await registerAndLogin(app, request));
    ({ token: modToken } = await registerModerator(app, request));

    const created = await request(app)
      .post('/api/fan-discussions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        topic: '管理员审核测试',
        personaIds,
      });
    discussionId = created.body.id;

    const reportRes = await request(app)
      .post('/api/content-reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        targetType: 'fan_discussion',
        targetId: discussionId,
        reason: '需要审核',
      });
    reportId = reportRes.body.id;
  });

  afterAll(() => {
    closeDb();
  });

  it('returns 403 for normal user on admin list', async () => {
    const res = await request(app)
      .get('/api/admin/content-reports')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with pending reports for moderator', async () => {
    const res = await request(app)
      .get('/api/admin/content-reports?status=pending')
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0]).toMatchObject({
      id: expect.any(String),
      targetType: 'fan_discussion',
      targetId: discussionId,
      status: 'pending',
      targetSummary: expect.any(String),
    });
  });

  it('returns 200 when moderator hides reported discussion and feed becomes hidden', async () => {
    const res = await request(app)
      .post(`/api/admin/content-reports/${reportId}/hide`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('hidden');

    const db = getDb();
    const discussion = db.prepare('SELECT status FROM fan_discussions WHERE id = ?').get(discussionId);
    expect(discussion.status).toBe('hidden');

    const feed = db.prepare(`
      SELECT visibility FROM feed_items WHERE event_key = ?
    `).get(`fan_discussion:${discussionId}`);
    expect(feed.visibility).toBe('hidden');

    const feedList = await request(app).get('/api/feed');
    expect(feedList.body.items.some((item) => item.eventKey === `fan_discussion:${discussionId}`)).toBe(false);
  });

  it('returns 403 when non-owner reads hidden discussion', async () => {
    const res = await request(app)
      .get(`/api/fan-discussions/${discussionId}`)
      .set('Authorization', `Bearer ${modToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 when moderator dismisses a pending report', async () => {
    const { personaIds } = seedFanPersonas();
    const created = await request(app)
      .post('/api/fan-discussions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ topic: '驳回测试', personaIds });

    const reportRes = await request(app)
      .post('/api/content-reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        targetType: 'fan_discussion',
        targetId: created.body.id,
        reason: '误报',
      });

    const res = await request(app)
      .post(`/api/admin/content-reports/${reportRes.body.id}/dismiss`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('dismissed');
  });
});
