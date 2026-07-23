import Parser from 'rss-parser';

const DEFAULT_SOURCES = [
  {
    id: 'bbc-football',
    name: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
  },
  {
    id: 'sky-football',
    name: 'Sky Sports',
    url: 'https://www.skysports.com/rss/12040',
  },
  {
    id: 'espn-football',
    name: 'ESPN FC',
    url: 'https://www.espn.com/espn/rss/soccer/news',
  },
];

/** Node Date 常无法解析的英语时区缩写 → RFC2822 偏移 */
const TZ_ABBR_TO_OFFSET = {
  UT: '+0000',
  UTC: '+0000',
  GMT: '+0000',
  BST: '+0100',
  WET: '+0000',
  WEST: '+0100',
  CET: '+0100',
  CEST: '+0200',
  EET: '+0200',
  EEST: '+0300',
  EST: '-0500',
  EDT: '-0400',
  CST: '-0600',
  CDT: '-0500',
  MST: '-0700',
  MDT: '-0600',
  PST: '-0800',
  PDT: '-0700',
};

const DEFAULT_HEADERS = {
  'User-Agent': 'FootballAICommunity/1.0 (+https://github.com/football-ai-community)',
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
};

/**
 * 解析 RSS 条目发布时间；无法解析时回退到 fallbackIso（默认当前时间）。
 * @param {{ isoDate?: string, pubDate?: string }} item
 * @param {string} [fallbackIso]
 * @returns {string} ISO-8601
 */
export function parseRssPublishedAt(item, fallbackIso = new Date().toISOString()) {
  const candidates = [item?.isoDate, item?.pubDate].filter(Boolean);
  for (const raw of candidates) {
    const parsed = tryParseRssDate(raw);
    if (parsed) return parsed.toISOString();
  }
  return fallbackIso;
}

/**
 * @param {string} raw
 * @returns {Date | null}
 */
export function tryParseRssDate(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  let date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;

  // 例: "Wed, 22 Jul 2026 21:30:00 BST" → GMT+0100（Node 不认 BST）
  const normalized = text.replace(/\b([A-Za-z]{2,5})\s*$/, (abbr) => {
    const offset = TZ_ABBR_TO_OFFSET[abbr.toUpperCase()];
    return offset ? `GMT${offset}` : abbr;
  });
  if (normalized !== text) {
    date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

export class NewsRssAdapter {
  constructor({ sources = DEFAULT_SOURCES, parser = new Parser(), fetchImpl = fetch } = {}) {
    this.sources = sources;
    this.parser = parser;
    this.fetchImpl = fetchImpl;
  }

  async fetchAllSources() {
    const results = await Promise.all(this.sources.map((source) => this.fetchSource(source)));
    return results;
  }

  async fetchSource(source) {
    const fetchedAt = new Date().toISOString();
    try {
      const xml = await this.fetchFeedXml(source.url);
      const feed = await this.parser.parseString(xml);
      const items = [];
      for (const item of feed.items ?? []) {
        try {
          const mapped = this.mapRssItem(item, source);
          if (mapped.title && mapped.sourceUrl) {
            items.push(mapped);
          }
        } catch {
          // 单条坏数据不拖垮整源
        }
      }
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'ok',
        fetchedAt,
        items,
        error: null,
      };
    } catch (err) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'down',
        fetchedAt,
        items: [],
        error: err.message,
      };
    }
  }

  async fetchFeedXml(url) {
    const response = await this.fetchImpl(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  }

  mapRssItem(item, source) {
    return {
      title: (item.title ?? '').trim(),
      sourceUrl: item.link ?? item.guid ?? null,
      sourceName: source.name,
      sourceId: source.id,
      publishedAt: parseRssPublishedAt(item),
      rawContent: item.contentSnippet || item.content || item.summary || '',
    };
  }
}
