import {
  NewsRssAdapter,
  parseRssPublishedAt,
  tryParseRssDate,
} from '../../src/adapters/news-rss-adapter.js';

describe('tryParseRssDate / parseRssPublishedAt', () => {
  it('解析 ISO 日期', () => {
    const d = tryParseRssDate('2026-07-22T16:36:07.000Z');
    expect(d.toISOString()).toBe('2026-07-22T16:36:07.000Z');
  });

  it('解析带 BST 的 RFC2822（Sky Sports）', () => {
    const d = tryParseRssDate('Wed, 22 Jul 2026 21:30:00 BST');
    expect(d).not.toBeNull();
    expect(d.toISOString()).toBe('2026-07-22T20:30:00.000Z');
  });

  it('优先使用 isoDate', () => {
    const iso = parseRssPublishedAt({
      isoDate: '2026-07-22T16:36:07.000Z',
      pubDate: 'Wed, 22 Jul 2026 21:30:00 BST',
    });
    expect(iso).toBe('2026-07-22T16:36:07.000Z');
  });

  it('无法解析时回退 fallback', () => {
    const iso = parseRssPublishedAt(
      { pubDate: 'not-a-date' },
      '2026-07-23T00:00:00.000Z',
    );
    expect(iso).toBe('2026-07-23T00:00:00.000Z');
  });
});

describe('NewsRssAdapter', () => {
  it('单条坏日期不导致整源 down', async () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <title>Test</title>
        <item>
          <title>Good</title>
          <link>https://example.com/1</link>
          <pubDate>Wed, 22 Jul 2026 21:30:00 BST</pubDate>
        </item>
        <item>
          <title>Also good</title>
          <link>https://example.com/2</link>
          <pubDate>2026-07-22T16:00:00.000Z</pubDate>
        </item>
      </channel></rss>`;

    const fetchImpl = async () => ({
      ok: true,
      text: async () => xml,
    });

    const adapter = new NewsRssAdapter({
      sources: [{ id: 'sky-football', name: 'Sky Sports', url: 'https://example.com/rss' }],
      fetchImpl,
    });

    const [result] = await adapter.fetchAllSources();
    expect(result.status).toBe('ok');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].publishedAt).toBe('2026-07-22T20:30:00.000Z');
    expect(result.items[1].publishedAt).toBe('2026-07-22T16:00:00.000Z');
  });

  it('HTTP 失败时标记 down 且不抛错', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 503,
      text: async () => '',
    });

    const adapter = new NewsRssAdapter({
      sources: [{ id: 'bbc-football', name: 'BBC Sport', url: 'https://example.com/rss' }],
      fetchImpl,
    });

    const [result] = await adapter.fetchAllSources();
    expect(result.status).toBe('down');
    expect(result.items).toEqual([]);
    expect(result.error).toMatch(/HTTP 503/);
  });
});
