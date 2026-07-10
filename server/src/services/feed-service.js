import { AppError } from '../middleware/error.js';
import { isDuplicateArticle } from './news-dedup.js';
import {
  createFeedItem,
  findFeedItemById,
  findFeedItemBySourceUrl,
  findRecentFeedItemsForDedup,
  findRelatedFeedItems,
  listFeedItems,
} from '../db/repositories/feed-item-repository.js';
import {
  buildSourceWarnings,
  getAggregateNewsStatus,
  upsertNewsCacheMeta,
} from '../db/repositories/news-cache-meta-repository.js';
import { NewsRssAdapter } from '../adapters/news-rss-adapter.js';
import { NewsAgent, buildFeedItemFromArticle } from '../agents/news-agent.js';
import { getOrCreatePreferenceByUserId } from '../db/repositories/user-preference-repository.js';
import { applyPreferenceFilteringAndSorting } from './feed-preference-sort.js';

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const MAX_POOL_SIZE = 500;

export function listFeed({ page = 1, pageSize = 20, agentId = null, userId = null } = {}) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));

  let items;
  let total;

  if (userId) {
    const preferences = getOrCreatePreferenceByUserId(userId);
    const pool = listFeedItems({ page: 1, pageSize: MAX_POOL_SIZE, agentId });
    const sorted = applyPreferenceFilteringAndSorting(pool.items, preferences);
    total = sorted.length;
    const offset = (safePage - 1) * safePageSize;
    items = sorted.slice(offset, offset + safePageSize);
  } else {
    const result = listFeedItems({ page: safePage, pageSize: safePageSize, agentId });
    items = result.items;
    total = result.total;
  }

  const warnings = buildSourceWarnings();

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function getFeedDetail(feedId) {
  const item = findFeedItemById(feedId);
  if (!item) {
    throw new AppError(404, 'not_found', '动态不存在');
  }

  const relatedItems = findRelatedFeedItems(feedId).map((related) => ({
    id: related.id,
    agentId: related.agentId,
    agentDisplayName: related.agentDisplayName,
    type: related.type,
    title: related.title,
    summary: related.summary,
    publishedAt: related.publishedAt,
  }));

  return {
    ...item,
    relatedItems,
  };
}

export function getHealthNewsMeta() {
  const { status, lastNewsFetchAt } = getAggregateNewsStatus();
  return {
    newsSourcesStatus: status,
    lastNewsFetchAt,
  };
}

export async function runNewsIngestion({ aiContentService, rssAdapter = new NewsRssAdapter() } = {}) {
  if (!aiContentService) {
    throw new Error('aiContentService is required');
  }

  const newsAgent = new NewsAgent({ aiContentService, rssAdapter });
  const sourceResults = await newsAgent.fetchSourceArticles();
  const existingArticles = findRecentFeedItemsForDedup({ hours: 48 });
  const createdItems = [];
  let skippedCount = 0;

  for (const sourceResult of sourceResults) {
    upsertNewsCacheMeta({
      sourceId: sourceResult.sourceId,
      lastFetchAt: sourceResult.fetchedAt,
      lastError: sourceResult.error,
      status: sourceResult.status,
    });

    for (const article of sourceResult.items) {
      if (!article.title || !article.sourceUrl) continue;
      if (!isRecentArticle(article.publishedAt)) continue;
      if (findFeedItemBySourceUrl(article.sourceUrl)) {
        skippedCount += 1;
        continue;
      }
      if (isDuplicateArticle(article, existingArticles)) {
        skippedCount += 1;
        continue;
      }

      const aiResult = await newsAgent.summarizeArticle(article);
      const feedItem = buildFeedItemFromArticle(article, aiResult);
      const created = createFeedItem(feedItem);
      createdItems.push(created);
      existingArticles.push({
        title: created.title,
        source_url: created.sourceUrl,
        event_key: created.eventKey,
      });
    }
  }

  return {
    createdCount: createdItems.length,
    skippedCount,
    sourceCount: sourceResults.length,
  };
}

function isRecentArticle(publishedAt) {
  const publishedMs = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedMs)) return false;
  return Date.now() - publishedMs <= HOURS_24_MS;
}
