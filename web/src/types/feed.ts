export interface FeedItem {
  id: string;
  agentId: string;
  agentDisplayName?: string;
  type: 'news_summary';
  title: string;
  summary?: string;
  publishedAt: string;
}

export interface FeedItemDetail extends FeedItem {
  sourceUrl?: string;
  sourceName?: string;
  keyPoints?: string[];
  relatedItems?: FeedItem[];
}

export interface FeedListResponse {
  items: FeedItem[];
  page: number;
  pageSize: number;
  total: number;
  warnings?: string[];
}
