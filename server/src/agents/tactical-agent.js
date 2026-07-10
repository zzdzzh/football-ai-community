import { AppError } from '../middleware/error.js';
import { buildTacticalContext } from '../services/tactical-context-builder.js';
import { createAiTacticalService } from '../ai/ai-tactical-service.js';

const ANALYSIS_LABELS = {
  post_match: '【赛后复盘】',
  pre_match_prediction: '【赛前战术预判】',
};

function capConfidence(current, max) {
  const order = ['low', 'medium', 'high'];
  if (order.indexOf(current) > order.indexOf(max)) {
    return max;
  }
  return current;
}

export class TacticalAgent {
  constructor({ aiTacticalService = null } = {}) {
    this.aiTacticalService = aiTacticalService ?? createAiTacticalService();
  }

  async handleQuestion({ contextType, contextId, userQuestion, userId = null }) {
    const context = buildTacticalContext({ contextType, contextId });

    if (context.notFound) {
      throw new AppError(404, 'not_found', '上下文资源不存在');
    }
    if (context.invalid) {
      throw new AppError(400, 'bad_request', '无效的上下文类型');
    }

    try {
      const reply = await this.aiTacticalService.analyze({
        question: userQuestion,
        analysisType: context.analysisType,
        context: context.payload,
        dataLimitations: context.dataLimitations,
        userId,
      });

      const confidence = capConfidence(reply.confidence ?? 'low', context.maxConfidence);
      const label = ANALYSIS_LABELS[context.analysisType] ?? '';
      const mergedLimitations = [
        ...new Set([...(context.dataLimitations ?? []), ...(reply.dataLimitations ?? [])]),
      ];

      const tacticalAnalysis = {
        analysisType: context.analysisType,
        formation: reply.formation ?? 'unknown',
        phases: reply.phases ?? [],
        keyPlayers: reply.keyPlayers ?? [],
        dataLimitations: mergedLimitations,
      };

      return {
        content: `${label}\n${reply.summary}`,
        tacticalAnalysis,
        confidence,
        missingFields: context.missingFields,
      };
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.statusCode === 408) {
        throw new AppError(408, 'timeout', 'Tactical Agent 响应超时');
      }
      throw err;
    }
  }
}

export function createTacticalAgent(overrides = {}) {
  return new TacticalAgent(overrides);
}
