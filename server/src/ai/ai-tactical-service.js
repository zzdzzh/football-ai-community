import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAiContentService } from './factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadTacticalAnalysisPrompt() {
  const promptPath = resolve(__dirname, '../../prompts/tactical-analysis.md');
  return readFileSync(promptPath, 'utf8');
}

function parseAnalysisJson(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式无效');
  }
  return JSON.parse(jsonMatch[0]);
}

export class AiTacticalService {
  constructor({ aiContentService = null } = {}) {
    this.aiContentService = aiContentService ?? createAiContentService();
    this.systemPrompt = loadTacticalAnalysisPrompt();
  }

  async analyze({ question, analysisType, context, dataLimitations = [], userId = null }) {
    const userPrompt = JSON.stringify({
      question,
      analysisType,
      context,
      dataLimitations,
    }, null, 2);

    const result = await this.aiContentService.generate({
      agentId: 'tactical',
      userId,
      requestType: 'generate',
      systemPrompt: this.systemPrompt,
      userPrompt,
    });

    const parsed = parseAnalysisJson(result.text);
    return {
      summary: parsed.summary ?? '',
      formation: parsed.formation ?? 'unknown',
      phases: Array.isArray(parsed.phases) ? parsed.phases : [],
      keyPlayers: Array.isArray(parsed.keyPlayers) ? parsed.keyPlayers : [],
      confidence: parsed.confidence ?? 'low',
      dataLimitations: Array.isArray(parsed.dataLimitations) ? parsed.dataLimitations : dataLimitations,
      model: result.model,
      durationMs: result.durationMs,
    };
  }
}

export function createAiTacticalService(overrides = {}) {
  return new AiTacticalService(overrides);
}
