import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAiContentService } from './factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRelationshipNarrativePrompt() {
  const promptPath = resolve(__dirname, '../../prompts/relationship-narrative.md');
  return readFileSync(promptPath, 'utf8');
}

export class AiRelationshipService {
  constructor({ aiContentService = null, systemPrompt = null } = {}) {
    this.aiContentService = aiContentService ?? createAiContentService();
    this.systemPrompt = systemPrompt ?? loadRelationshipNarrativePrompt();
  }

  async generateNarrative({ context, userId = null }) {
    const userPrompt = JSON.stringify(context, null, 2);
    const result = await this.aiContentService.generate({
      agentId: 'relationship',
      userId,
      requestType: 'generate',
      systemPrompt: this.systemPrompt,
      userPrompt,
    });
    return {
      text: result.text,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      durationMs: result.durationMs,
    };
  }
}

export function createAiRelationshipService(overrides = {}) {
  return new AiRelationshipService(overrides);
}
