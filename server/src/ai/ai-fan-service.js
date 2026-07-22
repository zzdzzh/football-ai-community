import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAiInteractiveContentService } from './factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFanDiscussionPrompt() {
  const promptPath = resolve(__dirname, '../../prompts/fan-discussion.md');
  return readFileSync(promptPath, 'utf8');
}

function parseTurnsJson(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式无效');
  }
  return JSON.parse(jsonMatch[0]);
}

export class AiFanService {
  constructor({ aiContentService = null } = {}) {
    this.aiContentService = aiContentService ?? createAiInteractiveContentService();
    this.systemPrompt = loadFanDiscussionPrompt();
  }

  async simulateTurns({
    topic,
    personas,
    context,
    history = [],
    mode = 'initial',
    targetTurnCount = 4,
    userId = null,
  }) {
    const userPrompt = JSON.stringify({
      topic,
      personas: personas.map((persona) => ({
        id: persona.id,
        displayName: persona.displayName,
        teamName: persona.teamName,
        styleTraits: persona.styleTraits,
        accentPhrases: persona.accentPhrases,
      })),
      context: {
        matchSummary: context.matchSummary ?? undefined,
        feedSnippet: context.feedSnippet ?? undefined,
      },
      history,
      mode,
      targetTurnCount,
    }, null, 2);

    const result = await this.aiContentService.generate({
      agentId: 'fan',
      userId,
      requestType: 'generate',
      systemPrompt: this.systemPrompt,
      userPrompt,
    });

    const parsed = parseTurnsJson(result.text);
    return {
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      disclaimer: parsed.disclaimer ?? '模拟内容仅供娱乐，不代表真实球迷或俱乐部立场',
      model: result.model,
      durationMs: result.durationMs,
    };
  }
}

export function createAiFanService(overrides = {}) {
  return new AiFanService(overrides);
}
