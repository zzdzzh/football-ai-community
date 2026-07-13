import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { buildFanContext } from '../../src/services/fan-context-builder.js';
import { seedTeamsAndMatches } from '../helpers/seed-match-data.js';

describe('FanContextBuilder', () => {
  beforeAll(() => {
    runMigrations();
    seedTeamsAndMatches();
  });

  afterAll(() => {
    closeDb();
  });

  it('builds topic-only context without matchId', () => {
    const context = buildFanContext({ topic: '  曼联 vs 利物浦赛后  ' });
    expect(context).toMatchObject({
      topic: '曼联 vs 利物浦赛后',
      matchSummary: null,
      feedSnippet: null,
    });
    expect(context.notFound).toBeUndefined();
  });

  it('builds match summary when matchId is valid', () => {
    const context = buildFanContext({
      topic: '赛后讨论',
      matchId: '1001',
    });
    expect(context.notFound).toBeUndefined();
    expect(context.matchSummary).toContain('Arsenal FC');
    expect(context.matchSummary).toContain('Chelsea FC');
    expect(context.matchSummary).toContain('2-1');
  });

  it('marks notFound when matchId is invalid', () => {
    const context = buildFanContext({
      topic: '赛后讨论',
      matchId: 'missing-match',
    });
    expect(context.notFound).toBe(true);
  });

  it('includes feed snippet when match report feed exists', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO feed_items (
        id, agent_id, type, title, summary, source_url, source_name,
        key_points, event_key, related_to, visibility, published_at, created_at,
        match_id, body_json, data_sources_json
      ) VALUES (?, 'content', 'match_report', '战报', '精彩对决摘要', NULL, NULL,
        NULL, ?, NULL, 'public', ?, ?, '1001', NULL, NULL)
    `).run('feed-match-1001', 'match_report:1001', now, now);

    const context = buildFanContext({
      topic: '赛后讨论',
      matchId: '1001',
    });
    expect(context.feedSnippet).toBe('精彩对决摘要');
  });
});
