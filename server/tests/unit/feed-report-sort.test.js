import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { listFeedItems } from '../../src/db/repositories/feed-item-repository.js';

describe('listFeedItems match-time sort', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM feed_items WHERE agent_id = 'content' AND match_id LIKE 'test-match-%'").run();
    db.prepare("DELETE FROM matches WHERE id LIKE 'test-match-%'").run();
    db.prepare("DELETE FROM teams WHERE id LIKE 'test-team-%'").run();
  });

  it('战报按比赛 utc_date 降序，而非生成时间', () => {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO teams (id, name, short_name, tla, league_code, updated_at)
      VALUES (?, 'Home A', 'HA', 'HA', 'PL', ?),
             (?, 'Away A', 'AA', 'AA', 'PL', ?),
             (?, 'Home B', 'HB', 'HB', 'PL', ?),
             (?, 'Away B', 'AB', 'AB', 'PL', ?)
    `).run(
      'test-team-ha', now,
      'test-team-aa', now,
      'test-team-hb', now,
      'test-team-ab', now,
    );

    db.prepare(`
      INSERT INTO matches (
        id, league_code, season, matchday, home_team_id, away_team_id,
        utc_date, status, home_score, away_score, data_completeness,
        last_synced_at, created_at, updated_at
      ) VALUES
        ('test-match-old', 'PL', '2025', 1, 'test-team-ha', 'test-team-aa',
         '2026-07-10T15:00:00.000Z', 'FINISHED', 1, 0, 'complete', ?, ?, ?),
        ('test-match-new', 'PL', '2025', 2, 'test-team-hb', 'test-team-ab',
         '2026-07-20T15:00:00.000Z', 'FINISHED', 2, 1, 'complete', ?, ?, ?)
    `).run(now, now, now, now, now, now);

    // 较新比赛的战报反而更早写入 published_at
    db.prepare(`
      INSERT INTO feed_items (
        id, agent_id, type, title, summary, visibility, published_at, created_at, match_id, event_key
      ) VALUES
        (?, 'content', 'match_report', '旧比赛战报', 'summary', 'public',
         '2026-07-22T10:00:00.000Z', ?, 'test-match-old', 'match_report:test-match-old'),
        (?, 'content', 'match_report', '新比赛战报', 'summary', 'public',
         '2026-07-21T10:00:00.000Z', ?, 'test-match-new', 'match_report:test-match-new')
    `).run(randomUUID(), now, randomUUID(), now);

    const { items } = listFeedItems({ page: 1, pageSize: 10, agentId: 'content' });
    const reportItems = items.filter((item) => item.matchId?.startsWith('test-match-'));
    expect(reportItems.map((item) => item.title)).toEqual(['新比赛战报', '旧比赛战报']);
    expect(reportItems[0].publishedAt).toBe('2026-07-20T15:00:00.000Z');
    expect(reportItems[1].publishedAt).toBe('2026-07-10T15:00:00.000Z');
  });
});
