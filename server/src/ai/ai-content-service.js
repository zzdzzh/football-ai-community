import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export class AiContentService {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async generate({ agentId, userId = null, requestType = 'generate', systemPrompt, userPrompt }) {
    const startedAt = Date.now();
    let status = 'success';
    let errorMessage = null;
    let result = null;

    try {
      result = await this.adapter.complete({ systemPrompt, userPrompt });
    } catch (err) {
      status = err.name === 'AbortError' ? 'timeout' : 'error';
      errorMessage = err.message;
      throw err;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logInteraction({
        userId,
        agentId,
        requestType,
        status,
        durationMs,
        model: result?.model ?? null,
        promptTokens: result?.promptTokens ?? null,
        completionTokens: result?.completionTokens ?? null,
        errorMessage,
      });
    }

    return {
      text: result.text,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      durationMs: Date.now() - startedAt,
    };
  }

  logInteraction({
    userId,
    agentId,
    requestType,
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
      agentId,
      requestType,
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
