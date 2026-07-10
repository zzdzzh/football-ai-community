import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';

function seedFeedItems() {
  const db = getDb();
  const now = new Date().toISOString();
  const mainId = randomUUID();
  const relatedId = randomUUID();

  db.prepare(`
    INSERT INTO feed_items (
      id, agent_id, type, title, summary, source_url, source_name,
      key_points, event_key, related_to, visibility, published_at, created_at
    ) VALUES (?, 'news', 'news_summary', ?, ?, ?, ?, ?, ?, NULL, 'public', ?, ?)
  `).run(
    mainId,
    '阿森纳 2-1 击败切尔西',
    '英超焦点战，阿森纳主场取胜。',
    'https://example.com/arsenal-chelsea',
    'BBC Sport',
    JSON.stringify(['萨卡破门', '切尔西红牌']),
    'arsenal-chelsea-2-1',
    now,
    now,
  );

  db.prepare(`
    INSERT INTO feed_items (
      id, agent_id, type, title, summary, source_url, source_name,
      key_points, event_key, related_to, visibility, published_at, created_at
    ) VALUES (?, 'news', 'news_summary', ?, ?, ?, ?, ?, ?, ?, 'public', ?, ?)
  `).run(
    relatedId,
    '相关报道：阿森纳胜利引热议',
    '赛后各方评论汇总。',
    'https://example.com/arsenal-chelsea-related',
    'Sky Sports',
    JSON.stringify(['赛后采访']),
    'arsenal-chelsea-2-1-related',
    mainId,
    now,
    now,
  );

  return { mainId, relatedId };
}

describe('Feed API contract', () => {
  let app;
  let mainId;

  beforeAll(() => {
    runMigrations();
    app = createApp();
    ({ mainId } = seedFeedItems());
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/feed', () => {
    it('returns 200 with paginated feed list', async () => {
      const res = await request(app).get('/api/feed');

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      const first = res.body.items[0];
      expect(first).toMatchObject({
        id: expect.any(String),
        agentId: 'news',
        agentDisplayName: '新闻 Agent',
        type: 'news_summary',
        title: expect.any(String),
        publishedAt: expect.any(String),
      });
    });

    it('filters by agentId', async () => {
      const res = await request(app).get('/api/feed?agentId=news');
      expect(res.status).toBe(200);
      expect(res.body.items.every((item) => item.agentId === 'news')).toBe(true);
    });
  });

  describe('GET /api/feed/{feedId}', () => {
    it('returns 200 with feed detail and related items', async () => {
      const res = await request(app).get(`/api/feed/${mainId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mainId);
      expect(res.body.sourceUrl).toBe('https://example.com/arsenal-chelsea');
      expect(res.body.sourceName).toBe('BBC Sport');
      expect(res.body.keyPoints).toEqual(expect.arrayContaining(['萨卡破门', '切尔西红牌']));
      expect(res.body.relatedItems).toEqual(expect.any(Array));
      expect(res.body.relatedItems.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for unknown feed id', async () => {
      const res = await request(app).get(`/api/feed/${randomUUID()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
