import { OpenAiCompatibleAdapter } from "../src/ai/adapters/openai-compatible.js";
import { AiContentService } from "../src/ai/ai-content-service.js";
import { NewsAgent, isDegradedSummary, DEGRADED_SUMMARY_MARKER } from "../src/agents/news-agent.js";
import { getDb } from "../src/db/connection.js";
import { updateFeedItemSummary } from "../src/db/repositories/feed-item-repository.js";
import { config } from "../src/config/index.js";
import { NewsRssAdapter } from "../src/adapters/news-rss-adapter.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isWeakSummary(summary) {
  if (!summary || typeof summary !== "string") return true;
  if (isDegradedSummary(summary)) return true;
  if (summary.length < 24) return true;
  return /信息有限|无法生成|无法提供完整摘要|摘要生成失败/.test(summary);
}

const includeWeak = process.argv.includes("--weak");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const db = getDb();
let rows = db.prepare(`
  SELECT id, title, summary, source_url AS sourceUrl, source_name AS sourceName, published_at AS publishedAt
  FROM feed_items
  WHERE agent_id = 'news'
    AND (
      summary LIKE ?
      OR (? = 1 AND (
        summary LIKE '%信息有限%'
        OR summary LIKE '%无法生成%'
        OR summary LIKE '%无法提供完整摘要%'
        OR length(summary) < 24
      ))
    )
  ORDER BY published_at DESC
`).all(`%${DEGRADED_SUMMARY_MARKER}%`, includeWeak ? 1 : 0);

if (Number.isFinite(limit) && limit > 0) {
  rows = rows.slice(0, limit);
}

console.log(JSON.stringify({ type: "retry_start", total: rows.length, includeWeak }, null, 0));

// 重试优先用交互式模型，避开 flash 高峰 429
const adapter = new OpenAiCompatibleAdapter({
  baseUrl: config.aiInteractive.baseUrl,
  apiKey: config.aiInteractive.apiKey,
  model: config.aiInteractive.model,
  timeoutMs: Math.min(config.aiInteractive.timeoutMs ?? 120000, 120000),
  maxRetries: 1,
  retryDelaysMs: [5000],
});
const newsAgent = new NewsAgent({
  aiContentService: new AiContentService(adapter),
  rssAdapter: new NewsRssAdapter(),
});

/** @type {Map<string, object>} */
const rssByUrl = new Map();
try {
  const sources = await newsAgent.fetchSourceArticles();
  for (const source of sources) {
    for (const item of source.items ?? []) {
      if (item.sourceUrl) rssByUrl.set(item.sourceUrl, item);
    }
  }
  console.log(JSON.stringify({ type: "rss_prefetch_ok", urls: rssByUrl.size }));
} catch (err) {
  console.log(JSON.stringify({
    type: "rss_prefetch_failed",
    message: err?.message ?? String(err),
  }));
}

let success = 0;
let failed = 0;

for (const row of rows) {
  if (!includeWeak && !isDegradedSummary(row.summary)) continue;
  if (includeWeak && !isWeakSummary(row.summary) && !isDegradedSummary(row.summary)) continue;

  const fromRss = rssByUrl.get(row.sourceUrl);
  const article = {
    title: row.title,
    sourceUrl: row.sourceUrl,
    sourceName: row.sourceName || fromRss?.sourceName || "unknown",
    publishedAt: row.publishedAt,
    rawContent: fromRss?.rawContent || fromRss?.title || row.title,
  };
  await sleep(config.newsSummaryDelayMs ?? 1500);
  const aiResult = await newsAgent.summarizeArticle(article);
  if (
    aiResult.summaryStatus === "success"
    && !isDegradedSummary(aiResult.summary)
    && String(aiResult.summary).trim().length >= 16
  ) {
    updateFeedItemSummary(row.id, {
      summary: aiResult.summary,
      keyPoints: aiResult.keyPoints,
      eventKey: aiResult.eventKey,
    });
    success += 1;
    console.log(JSON.stringify({
      type: "retry_ok",
      id: row.id,
      title: row.title.slice(0, 60),
      summary: String(aiResult.summary).slice(0, 80),
    }));
  } else {
    failed += 1;
    console.log(JSON.stringify({
      type: "retry_fail",
      id: row.id,
      title: row.title.slice(0, 60),
      summaryStatus: aiResult.summaryStatus,
      summary: String(aiResult.summary ?? "").slice(0, 80),
    }));
  }
}

console.log(JSON.stringify({ type: "retry_done", success, failed, total: rows.length }));
