import { AppError } from '../middleware/error.js';
import { assertAiRateLimit } from './ai-rate-limit.js';
import { findCareerPlayerById } from '../db/repositories/career-player-repository.js';
import { findPlayerPairAnalysis } from '../db/repositories/player-pair-analysis-repository.js';
import {
  findByAnalysisVersion,
} from '../db/repositories/relationship-narrative-repository.js';
import {
  createRelationshipNarrativeAgent,
} from '../agents/relationship-narrative-agent.js';

function orderPair(playerIdA, playerIdB) {
  return playerIdA < playerIdB
    ? [playerIdA, playerIdB]
    : [playerIdB, playerIdA];
}

function toResponse(narrative, { playerIdA, playerIdB, reused }) {
  return {
    status: 'ready',
    id: narrative.id,
    playerIdA,
    playerIdB,
    analysisId: narrative.analysisId,
    analysisComputedAt: narrative.analysisComputedAt,
    narrativeText: narrative.narrativeText,
    aiGenerated: true,
    reused,
    model: narrative.model ?? null,
    createdAt: narrative.createdAt,
    updatedAt: narrative.updatedAt,
  };
}

function resolveReadyAnalysis(playerIdA, playerIdB, analysisOverride) {
  if (analysisOverride) {
    return analysisOverride;
  }

  const playerA = findCareerPlayerById(playerIdA);
  const playerB = findCareerPlayerById(playerIdB);
  if (!playerA || !playerB) {
    throw new AppError(404, 'not_found', '球员不存在');
  }

  if (playerA.syncStatus === 'syncing' || playerB.syncStatus === 'syncing') {
    throw new AppError(409, 'analysis_not_ready', '球员履历仍在同步，分析尚未就绪');
  }

  const cached = findPlayerPairAnalysis(playerIdA, playerIdB);
  if (!cached?.result || !cached.computedAt) {
    throw new AppError(409, 'analysis_not_ready', '球员对分析尚未就绪，请先完成关系分析');
  }

  return {
    id: cached.id,
    status: 'ready',
    playerIdLow: cached.playerIdLow,
    playerIdHigh: cached.playerIdHigh,
    computedAt: cached.computedAt,
    result: cached.result,
    dataFreshness: cached.dataFreshness,
    playerA: { id: playerA.id, name: playerA.name },
    playerB: { id: playerB.id, name: playerB.name },
  };
}

/**
 * 生成或复用关系叙事。
 * 测试可注入 analysisOverride / agentOverride / rateLimit / testMode。
 */
export async function generateRelationshipNarrative({
  playerIdA,
  playerIdB,
  userId,
  force = false,
  analysisOverride = null,
  agentOverride = null,
  rateLimit = null,
  testMode = null,
} = {}) {
  if (!userId) {
    throw new AppError(401, 'unauthorized', '请先登录');
  }
  if (!playerIdA || !playerIdB || playerIdA === playerIdB) {
    throw new AppError(400, 'bad_request', '无效的球员对');
  }

  if (testMode === 'rate_limited') {
    throw new AppError(429, 'rate_limited', '提问过于频繁，请稍后再试');
  }
  if (testMode === 'timeout') {
    throw new AppError(408, 'timeout', '关系叙事生成超时，请稍后重试');
  }
  if (testMode === 'upstream_fail') {
    throw new AppError(503, 'service_unavailable', '关系叙事服务暂时不可用，请稍后重试');
  }
  if (testMode === 'verification_failed') {
    throw new AppError(422, 'narrative_verification_failed', '叙事未通过事实核验，未采信');
  }

  const analysis = resolveReadyAnalysis(playerIdA, playerIdB, analysisOverride);

  if (!force) {
    const existing = findByAnalysisVersion(analysis.id, analysis.computedAt);
    if (existing?.status === 'ready' && existing.narrativeText) {
      return toResponse(existing, { playerIdA, playerIdB, reused: true });
    }
  }

  const rateOpts = rateLimit
    ? {
      userId,
      agentId: 'relationship',
      maxPerWindow: rateLimit.maxPerWindow,
      windowMs: rateLimit.windowMs,
    }
    : { userId, agentId: 'relationship' };
  assertAiRateLimit(rateOpts);

  const agent = agentOverride ?? createRelationshipNarrativeAgent();
  const generated = await agent.generate({ analysis, userId });

  return toResponse(generated, {
    playerIdA,
    playerIdB,
    reused: false,
  });
}

export async function getRelationshipNarrative({
  playerIdA,
  playerIdB,
  userId,
} = {}) {
  if (!userId) {
    throw new AppError(401, 'unauthorized', '请先登录');
  }

  const analysis = resolveReadyAnalysis(playerIdA, playerIdB, null);
  const existing = findByAnalysisVersion(analysis.id, analysis.computedAt);
  if (!existing || existing.status !== 'ready' || !existing.narrativeText) {
    throw new AppError(404, 'not_found', '尚无与当前结论版本匹配的叙事');
  }

  return toResponse(existing, { playerIdA, playerIdB, reused: true });
}

export { orderPair };
