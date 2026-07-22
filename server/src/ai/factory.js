import { config } from '../config/index.js';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.js';
import { AiContentService } from './ai-content-service.js';

function createAdapter(aiConfig) {
  return new OpenAiCompatibleAdapter({
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    timeoutMs: aiConfig.timeoutMs,
    maxRetries: aiConfig.maxRetries,
    retryDelaysMs: aiConfig.retryDelaysMs,
  });
}

/** 自动内容：比赛战报、新闻 AI 摘要等（AI_* / glm-4.7-flash） */
export function createAiContentService() {
  return new AiContentService(createAdapter(config.ai));
}

/** 交互式：球员推荐、球迷对话、Stats/Tactical、关系叙事等（AI_INTERACTIVE_*） */
export function createAiInteractiveContentService() {
  return new AiContentService(createAdapter(config.aiInteractive));
}

export {
  AiRelationshipService,
  createAiRelationshipService,
} from './ai-relationship-service.js';
