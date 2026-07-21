export interface FeedItemBody {
  discussionId?: string;
  personaIds?: string[];
  turnCount?: number;
}

export interface FeedItem {
  id: string;
  agentId: string;
  agentDisplayName?: string;
  type: 'news_summary' | 'fan_discussion' | 'match_report' | 'brief_report';
  title: string;
  summary?: string;
  publishedAt: string;
  eventKey?: string;
  matchId?: string;
  body?: FeedItemBody;
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
