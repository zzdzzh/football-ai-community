import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAiInteractiveContentService } from './factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScoutRecommendPrompt() {
  const promptPath = resolve(__dirname, '../../prompts/scout-recommend.md');
  return readFileSync(promptPath, 'utf8');
}

function parseRecommendJson(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式无效');
  }
  return JSON.parse(jsonMatch[0]);
}

export class AiScoutService {
  constructor({ aiContentService = null } = {}) {
    this.aiContentService = aiContentService ?? createAiInteractiveContentService();
    this.systemPrompt = loadScoutRecommendPrompt();
  }

  async recommend({ question, filters, candidates, userId = null }) {
    const userPrompt = JSON.stringify({
      question,
      filters,
      candidates,
    }, null, 2);

    const result = await this.aiContentService.generate({
      agentId: 'scout',
      userId,
      requestType: 'generate',
      systemPrompt: this.systemPrompt,
      userPrompt,
    });

    const parsed = parseRecommendJson(result.text);
    return {
      summary: parsed.summary ?? '',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      narrowHint: parsed.narrowHint ?? null,
      confidence: parsed.confidence ?? 'low',
      model: result.model,
      durationMs: result.durationMs,
    };
  }
}

export function createAiScoutService(overrides = {}) {
  return new AiScoutService(overrides);
}
