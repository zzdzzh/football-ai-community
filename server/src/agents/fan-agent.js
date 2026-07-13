import { AppError } from '../middleware/error.js';
import { config } from '../config/index.js';
import { createAiFanService } from '../ai/ai-fan-service.js';
import { findFanPersonasByIds } from '../db/repositories/fan-persona-repository.js';
import { buildFanContext } from '../services/fan-context-builder.js';
import { defaultContentModerationService } from '../services/content-moderation-service.js';

export const FAN_DISCLAIMER = '模拟内容仅供娱乐，不代表真实球迷或俱乐部立场';
export const INITIAL_TURN_TARGET = 4;

function resolveAiUnavailableMessage(err, fallback) {
  if (typeof err.details !== 'string') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(err.details);
    const providerMsg = parsed?.error?.message ?? parsed?.message ?? '';
    const providerCode = parsed?.error?.code;
    if (providerCode === '1113' || /余额|资源包|充值/.test(providerMsg)) {
      return 'AI 服务余额不足或无可用资源包，请充值后重试';
    }
    if (providerMsg) {
      return providerMsg;
    }
  } catch {
    // ignore malformed provider payload
  }
  return fallback;
}

export class FanAgent {
  constructor({
    aiFanService = null,
    moderationService = null,
    initialTimeoutMs = 60000,
    continueTimeoutMs = null,
  } = {}) {
    this.aiFanService = aiFanService ?? createAiFanService();
    this.moderationService = moderationService ?? defaultContentModerationService;
    this.initialTimeoutMs = initialTimeoutMs;
    this.continueTimeoutMs = continueTimeoutMs ?? config.fan.continueTimeoutMs;
  }

  validatePersonas(personaIds) {
    if (!Array.isArray(personaIds) || personaIds.length < 2) {
      throw new AppError(400, 'bad_request', '至少选择 2 个 Fan Persona');
    }
    const unique = new Set(personaIds);
    if (unique.size !== personaIds.length) {
      throw new AppError(400, 'bad_request', 'Persona 不能重复');
    }
    const personas = findFanPersonasByIds(personaIds);
    if (personas.length !== personaIds.length) {
      throw new AppError(400, 'bad_request', '存在无效或未启用的 Persona');
    }
    return personas;
  }

  assertContentAllowed(text) {
    const result = this.moderationService.check(text);
    if (!result.allowed) {
      throw new AppError(422, 'content_policy_violation', '内容违反社区规范');
    }
  }

  assertAiTurnsAllowed(turns) {
    for (const turn of turns) {
      this.assertContentAllowed(turn.content);
    }
  }

  mapAiError(err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.statusCode === 408) {
      throw new AppError(408, 'timeout', 'Fan Agent 响应超时');
    }
    if (err.statusCode === 429) {
      throw new AppError(
        503,
        'service_unavailable',
        resolveAiUnavailableMessage(err, 'AI 服务请求过于频繁，请稍后再试'),
      );
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
      throw new AppError(503, 'service_unavailable', 'AI 服务凭证无效或未配置');
    }
    if (typeof err.statusCode === 'number' && err.statusCode >= 500) {
      throw new AppError(503, 'service_unavailable', 'AI 服务暂不可用，请稍后再试');
    }
    throw err;
  }

  async createInitialDiscussion({ userId, topic, personaIds, matchId = null }) {
    const personas = this.validatePersonas(personaIds);
    const context = buildFanContext({ topic, matchId });
    if (context.notFound) {
      throw new AppError(404, 'not_found', '关联比赛不存在');
    }

    let aiResult;
    try {
      aiResult = await this.aiFanService.simulateTurns({
        topic,
        personas,
        context,
        history: [],
        mode: 'initial',
        targetTurnCount: INITIAL_TURN_TARGET,
        userId,
      });
    } catch (err) {
      this.mapAiError(err);
    }

    this.assertAiTurnsAllowed(aiResult.turns);
    if (aiResult.turns.length < INITIAL_TURN_TARGET) {
      throw new AppError(503, 'service_unavailable', 'Fan Agent 生成轮次不足');
    }

    return {
      personas,
      context,
      aiResult,
      disclaimer: aiResult.disclaimer ?? FAN_DISCLAIMER,
    };
  }

  async continueDiscussion({
    userId,
    topic,
    personas,
    context,
    history,
    userContent,
  }) {
    this.assertContentAllowed(userContent);

    let aiResult;
    try {
      aiResult = await this.aiFanService.simulateTurns({
        topic,
        personas,
        context,
        history,
        mode: 'continue',
        targetTurnCount: 2,
        userId,
      });
    } catch (err) {
      this.mapAiError(err);
    }

    this.assertAiTurnsAllowed(aiResult.turns);
    return aiResult;
  }
}

export function createFanAgent(overrides = {}) {
  return new FanAgent(overrides);
}
