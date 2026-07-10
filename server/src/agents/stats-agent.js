import { AppError } from '../middleware/error.js';
import { buildStatsContext, findSimilarTeams } from '../services/stats-context-builder.js';
import { createAiAnalysisService } from '../ai/ai-analysis-service.js';

export class StatsAgent {
  constructor({ aiAnalysisService = null } = {}) {
    this.aiAnalysisService = aiAnalysisService ?? createAiAnalysisService();
  }

  async handleQuestion({ contextType, contextId, userQuestion, userId = null }) {
    const context = buildStatsContext({ contextType, contextId });

    if (context.notFound) {
      if (contextType === 'team') {
        const suggestions = findSimilarTeams(userQuestion);
        if (suggestions.length > 0) {
          throw new AppError(404, 'not_found', `未找到球队，您是否指的是：${suggestions.map((t) => t.name).join('、')}`);
        }
      }
      throw new AppError(404, 'not_found', '上下文资源不存在');
    }

    if (context.invalid) {
      throw new AppError(400, 'bad_request', '无效的上下文类型');
    }

    if (context.syncMessage) {
      throw new AppError(503, 'service_unavailable', context.syncMessage);
    }

    const analysis = await this.aiAnalysisService.analyze({
      contextPayload: context.payload,
      userQuestion,
      userId,
    });

    const confidence = context.missingFields.length > 0 && analysis.confidence === 'high'
      ? 'medium'
      : analysis.confidence;

    return {
      content: analysis.interpretation,
      metrics: analysis.metrics,
      confidence,
      missingFields: [...new Set([...context.missingFields, ...analysis.missingFields])],
    };
  }
}

export function createStatsAgent(overrides = {}) {
  return new StatsAgent(overrides);
}
