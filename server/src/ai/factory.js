import { config } from '../config/index.js';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.js';
import { AiContentService } from './ai-content-service.js';

export function createAiContentService() {
  const adapter = new OpenAiCompatibleAdapter({
    baseUrl: config.ai.baseUrl,
    apiKey: config.ai.apiKey,
    model: config.ai.model,
    timeoutMs: config.ai.timeoutMs,
  });
  return new AiContentService(adapter);
}
