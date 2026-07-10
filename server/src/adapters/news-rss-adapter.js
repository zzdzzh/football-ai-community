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
      const feed = await this.parser.parseURL(source.url);
      const items = (feed.items ?? []).map((item) => this.mapRssItem(item, source));
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

  mapRssItem(item, source) {
    const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
    return {
      title: (item.title ?? '').trim(),
      sourceUrl: item.link ?? item.guid ?? null,
      sourceName: source.name,
      sourceId: source.id,
      publishedAt: new Date(publishedAt).toISOString(),
      rawContent: item.contentSnippet || item.content || item.summary || '',
    };
  }
}
