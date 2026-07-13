import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, '../../prompts/news-summary.md');
export const DEGRADED_SUMMARY_MARKER = '摘要生成失败';

export function isDegradedSummary(summary) {
  return typeof summary === 'string' && summary.includes(DEGRADED_SUMMARY_MARKER);
}

function loadPromptTemplate() {
  return readFileSync(PROMPT_PATH, 'utf8');
}

function renderPrompt(article) {
  return loadPromptTemplate()
    .replace('{{title}}', article.title)
    .replace('{{source_name}}', article.sourceName)
    .replace('{{published_at}}', article.publishedAt)
    .replace('{{raw_content}}', article.rawContent || article.title);
}

function parseAiJson(text) {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;

  try {
    const parsed = JSON.parse(jsonText);
    return {
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      eventKey: parsed.event_key || null,
    };
  } catch {
    return {
      summary: trimmed.slice(0, 300),
      keyPoints: [],
      eventKey: null,
    };
  }
}

export class NewsAgent {
  constructor({ aiContentService, rssAdapter }) {
    this.aiContentService = aiContentService;
    this.rssAdapter = rssAdapter;
  }

  async fetchSourceArticles() {
    return this.rssAdapter.fetchAllSources();
  }

  async summarizeArticle(article) {
    const userPrompt = renderPrompt(article);
    try {
      const result = await this.aiContentService.generate({
        agentId: 'news',
        requestType: 'cron',
        systemPrompt: '你是专业足球新闻编辑，输出必须是合法 JSON。',
        userPrompt,
      });
      const parsed = parseAiJson(result.text);
      return {
        ...parsed,
        summaryStatus: 'success',
      };
    } catch {
      return {
        summary: `${article.title}（${DEGRADED_SUMMARY_MARKER}，请查看原文）`,
        keyPoints: [],
        eventKey: null,
        summaryStatus: 'degraded',
      };
    }
  }
}

export function buildFeedItemFromArticle(article, aiResult, { relatedTo = null } = {}) {
  return {
    agentId: 'news',
    type: 'news_summary',
    title: article.title,
    summary: aiResult.summary,
    sourceUrl: article.sourceUrl,
    sourceName: article.sourceName,
    keyPoints: aiResult.keyPoints,
    eventKey: aiResult.eventKey,
    relatedTo,
    publishedAt: article.publishedAt,
  };
}
