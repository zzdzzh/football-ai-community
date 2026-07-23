import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReportContext } from '../services/stats-context-builder.js';
import { createAiContentService } from '../ai/factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, '../../prompts/match-report.md');

function loadPromptTemplate() {
  return readFileSync(PROMPT_PATH, 'utf8');
}

function parseAiJson(text) {
  const trimmed = (text ?? '').trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function scoreLine(match) {
  if (match.homeScore === null || match.awayScore === null) {
    return '比分待定';
  }
  return `${match.homeScore}-${match.awayScore}`;
}

function buildFallbackReport(match, reportContext) {
  const home = match.homeTeam?.name ?? '主队';
  const away = match.awayTeam?.name ?? '客队';
  const score = scoreLine(match);
  const missing = reportContext.missingFields;
  const isBrief = reportContext.isBrief;

  const summary = isBrief
    ? `${home} ${score} ${away}。数据不完整（缺失：${missing.join('、') || '未知'}），仅发布简要战报，未补充虚构细节。`
    : `${home} ${score} ${away}。基于已同步比赛数据生成的简要战报。`;

  return {
    title: `${home} ${score} ${away}`,
    summary,
    sections: [
      {
        heading: isBrief ? '简要说明' : '走势评述',
        content: isBrief
          ? `本场数据尚不完整，已标注缺失项：${missing.join('、') || '无'}。系统未编造比分或事件。`
          : `本场比分为 ${score}。因 AI 生成失败，仅保留可核验的比分与已知事件，未补充虚构细节。`,
      },
    ],
    timeline: Array.isArray(match.events) ? match.events : [],
  };
}

function normalizeTimeline(timeline, matchEvents) {
  const source = Array.isArray(matchEvents) ? matchEvents : [];
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return source;
  }
  return timeline.filter((event) => (
    event
    && typeof event === 'object'
    && source.some((src) => (
      src.minute === event.minute
      && src.type === event.type
      && String(src.teamId) === String(event.teamId)
    ))
  ));
}

export class ContentAgent {
  constructor({ aiContentService = null } = {}) {
    this.aiContentService = aiContentService ?? createAiContentService();
  }

  async generateMatchReport(match) {
    if (!match || match.status !== 'FINISHED') {
      return { skipped: true, reason: 'not_finished' };
    }

    if (match.dataCompleteness === 'pending' && (match.homeScore === null || match.awayScore === null)) {
      return { skipped: true, reason: 'data_pending' };
    }

    const reportContext = buildReportContext(match);
    const type = reportContext.isBrief ? 'brief_report' : 'match_report';
    const home = match.homeTeam?.name ?? '主队';
    const away = match.awayTeam?.name ?? '客队';
    const eventKey = `match_report:${match.id}`;

    let parsed = null;
    try {
      const userPrompt = `${loadPromptTemplate()}\n\n## 比赛数据 JSON\n\n\`\`\`json\n${JSON.stringify({
        match: reportContext.payload.match,
        stats: match.stats ?? [],
        events: match.events ?? [],
        missingFields: reportContext.missingFields,
        isBrief: reportContext.isBrief,
      }, null, 2)}\n\`\`\``;

      const result = await this.aiContentService.generate({
        agentId: 'content',
        requestType: 'cron',
        systemPrompt: '你是足球赛后报道编辑，输出必须是合法 JSON，禁止编造事实。',
        userPrompt,
      });
      parsed = parseAiJson(result.text);
    } catch {
      parsed = null;
    }

    const fallback = buildFallbackReport(match, reportContext);
    const title = (parsed?.title && String(parsed.title).trim()) || fallback.title;
    const summary = (parsed?.summary && String(parsed.summary).trim()) || fallback.summary;
    const sections = Array.isArray(parsed?.sections) && parsed.sections.length > 0
      ? parsed.sections
      : fallback.sections;
    const timeline = normalizeTimeline(parsed?.timeline, match.events);

    return {
      skipped: false,
      type,
      eventKey,
      matchId: match.id,
      publishedAt: match.utcDate ?? undefined,
      title: title.slice(0, 200),
      summary,
      body: {
        sections,
        timeline,
        missingFields: reportContext.missingFields,
        scoreLine: scoreLine(match),
        homeTeamName: home,
        awayTeamName: away,
      },
      dataSources: ['stats_snapshot'],
      missingFields: reportContext.missingFields,
    };
  }
}

export function createContentAgent(overrides = {}) {
  return new ContentAgent(overrides);
}
