import { config } from '../config/index.js';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.js';
import { AiContentService } from './ai-content-service.js';

export function createAiContentService() {
  const adapter = new OpenAiCompatibleAdapter({
    baseUrl: config.ai.baseUrl,
    apiKey: config.ai.apiKey,
    model: config.ai.model,
    timeoutMs: config.ai.timeoutMs,
    maxRetries: config.ai.maxRetries,
    retryDelaysMs: config.ai.retryDelaysMs,
  });
  return new AiContentService(adapter);
}

export {
  AiRelationshipService,
  createAiRelationshipService,
} from './ai-relationship-service.js';
