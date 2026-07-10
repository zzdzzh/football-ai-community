import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { createAiContentService } from './factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadStatsInterpretPrompt() {
  const promptPath = resolve(__dirname, '../../prompts/stats-interpret.md');
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

export class AiAnalysisService {
  constructor({ aiContentService = null } = {}) {
    this.aiContentService = aiContentService ?? createAiContentService();
    this.systemPrompt = loadStatsInterpretPrompt();
  }

  async analyze({ contextPayload, userQuestion, userId = null }) {
    const userPrompt = JSON.stringify({
      question: userQuestion,
      data: contextPayload,
    }, null, 2);

    const result = await this.aiContentService.generate({
      agentId: 'stats',
      userId,
      requestType: 'generate',
      systemPrompt: this.systemPrompt,
      userPrompt,
    });

    const parsed = parseAnalysisJson(result.text);
    return {
      interpretation: parsed.interpretation ?? '',
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      confidence: parsed.confidence ?? 'low',
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
      model: result.model,
      durationMs: result.durationMs,
    };
  }

  logInteraction({
    userId,
    status,
    durationMs,
    model,
    promptTokens,
    completionTokens,
    errorMessage,
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO agent_interaction_logs (
        id, user_id, agent_id, request_type, status, duration_ms,
        model, prompt_tokens, completion_tokens, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId,
      'stats',
      'generate',
      status,
      durationMs,
      model,
      promptTokens,
      completionTokens,
      errorMessage,
      new Date().toISOString(),
    );
  }
}

export function createAiAnalysisService(overrides = {}) {
  return new AiAnalysisService(overrides);
}
