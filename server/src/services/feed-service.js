import { AppError } from '../middleware/error.js';
import { config } from '../config/index.js';
import { findDuplicateParent } from './news-dedup.js';
import {
  createFeedItem,
  findFeedItemById,
  findFeedItemBySourceUrl,
  findFeedItemByEventKey,
  findRecentFeedItemsForDedup,
  findRelatedFeedItems,
  listFeedItems,
  updateFeedItemSummary,
  updateFeedItemVisibilityByEventKey,
} from '../db/repositories/feed-item-repository.js';
import {
  buildSourceWarnings,
  getAggregateNewsStatus,
  upsertNewsCacheMeta,
} from '../db/repositories/news-cache-meta-repository.js';
import { NewsRssAdapter } from '../adapters/news-rss-adapter.js';
import { NewsAgent, buildFeedItemFromArticle, isDegradedSummary } from '../agents/news-agent.js';
import { getOrCreatePreferenceByUserId } from '../db/repositories/user-preference-repository.js';
import { applyPreferenceFilteringAndSorting } from './feed-preference-sort.js';

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const MAX_POOL_SIZE = 500;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function summarizeWithThrottle(newsAgent, article) {
  await sleep(config.newsSummaryDelayMs);
  return newsAgent.summarizeArticle(article);
}

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
  const existingArticles = findRecentFeedItemsForDedup({ hours: 48 }).map((item) => ({
    id: item.id,
    title: item.title,
    source_url: item.source_url,
    event_key: item.event_key,
  }));
  const createdItems = [];
  let skippedCount = 0;
  let relatedCount = 0;
  let retriedCount = 0;

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

      const existingByUrl = findFeedItemBySourceUrl(article.sourceUrl);
      if (existingByUrl) {
        if (isDegradedSummary(existingByUrl.summary)) {
          const aiResult = await summarizeWithThrottle(newsAgent, article);
          if (aiResult.summaryStatus === 'success') {
            updateFeedItemSummary(existingByUrl.id, {
              summary: aiResult.summary,
              keyPoints: aiResult.keyPoints,
              eventKey: aiResult.eventKey,
            });
            retriedCount += 1;
          } else {
            skippedCount += 1;
          }
        } else {
          skippedCount += 1;
        }
        continue;
      }

      const duplicateParent = findDuplicateParent(article, existingArticles);
      if (duplicateParent) {
        const aiResult = await summarizeWithThrottle(newsAgent, article);
        const feedItem = buildFeedItemFromArticle(article, aiResult, { relatedTo: duplicateParent.id });
        const created = createFeedItem(feedItem);
        if (!created) {
          skippedCount += 1;
          continue;
        }
        relatedCount += 1;
        existingArticles.push({
          id: created.id,
          title: created.title,
          source_url: created.sourceUrl,
          event_key: created.eventKey,
        });
        continue;
      }

      const aiResult = await summarizeWithThrottle(newsAgent, article);
      const feedItem = buildFeedItemFromArticle(article, aiResult);
      const created = createFeedItem(feedItem);
      if (!created) {
        skippedCount += 1;
        continue;
      }
      createdItems.push(created);
      existingArticles.push({
        id: created.id,
        title: created.title,
        source_url: created.sourceUrl,
        event_key: created.eventKey,
      });
    }
  }

  return {
    createdCount: createdItems.length,
    relatedCount,
    skippedCount,
    retriedCount,
    sourceCount: sourceResults.length,
  };
}

function isRecentArticle(publishedAt) {
  const publishedMs = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedMs)) return false;
  return Date.now() - publishedMs <= HOURS_24_MS;
}

export function buildFanDiscussionEventKey(discussionId) {
  return `fan_discussion:${discussionId}`;
}

export function publishFanDiscussionFeedItem({
  discussionId,
  topic,
  personaIds,
  turns,
  matchId = null,
}) {
  const eventKey = buildFanDiscussionEventKey(discussionId);
  const existing = findFeedItemByEventKey(eventKey);
  if (existing) {
    return existing;
  }

  const summaryParts = turns
    .filter((turn) => turn.role === 'persona' && turn.content)
    .slice(0, 2)
    .map((turn) => turn.content);
  const summary = summaryParts.join(' · ').slice(0, 280) || topic;

  return createFeedItem({
    agentId: 'fan',
    type: 'fan_discussion',
    title: topic,
    summary,
    eventKey,
    matchId,
    visibility: 'public',
    body: {
      discussionId,
      personaIds,
      turnCount: turns.length,
    },
  });
}

export function hideFanDiscussionFeedItem(discussionId) {
  const eventKey = buildFanDiscussionEventKey(discussionId);
  return updateFeedItemVisibilityByEventKey(eventKey, 'hidden');
}
