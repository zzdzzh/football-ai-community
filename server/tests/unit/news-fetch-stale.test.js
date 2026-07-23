import { runMigrations } from '../../src/db/migrate.js';
import { getDb } from '../../src/db/connection.js';
import { isNewsFetchStale } from '../../src/jobs/news-fetch.js';
import { upsertNewsCacheMeta } from '../../src/db/repositories/news-cache-meta-repository.js';

describe('isNewsFetchStale', () => {
  beforeAll(() => {
    runMigrations();
  });

  beforeEach(() => {
    getDb().prepare('DELETE FROM news_cache_meta').run();
  });

  it('无抓取记录视为过期', () => {
    expect(isNewsFetchStale(30)).toBe(true);
  });

  it('最近抓取未过期', () => {
    upsertNewsCacheMeta({
      sourceId: 'espn-football',
      lastFetchAt: new Date().toISOString(),
      lastError: null,
      status: 'ok',
    });
    expect(isNewsFetchStale(30)).toBe(false);
  });

  it('超过阈值视为过期', () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    upsertNewsCacheMeta({
      sourceId: 'espn-football',
      lastFetchAt: old,
      lastError: null,
      status: 'ok',
    });
    expect(isNewsFetchStale(30)).toBe(true);
  });
});
