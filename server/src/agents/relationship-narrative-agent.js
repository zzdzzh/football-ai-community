import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '../middleware/error.js';
import { createAiRelationshipService } from '../ai/ai-relationship-service.js';
import { verifyNarrativeOutput } from '../services/relationship-narrative-verifier.js';
import { upsertReadyNarrative } from '../db/repositories/relationship-narrative-repository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, '../../prompts/relationship-narrative.md');

function promptVersion() {
  const raw = readFileSync(PROMPT_PATH, 'utf8');
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

function parseNarrativeJson(text) {
  const trimmed = String(text ?? '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError(422, 'narrative_verification_failed', '模型输出不是合法 JSON');
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new AppError(422, 'narrative_verification_failed', '模型输出 JSON 解析失败');
  }
}

function mapAiError(err) {
  if (err instanceof AppError) return err;
  if (err?.name === 'AbortError' || err?.code === 'TIMEOUT' || err?.statusCode === 408
    || /timeout/i.test(err?.message ?? '')) {
    return new AppError(408, 'timeout', '关系叙事生成超时，请稍后重试');
  }
  // 智谱免费 flash 等上游限流常返回 429；勿笼统报「服务不可用」
  if (err?.statusCode === 429) {
    return new AppError(
      429,
      'rate_limited',
      '模型调用过于频繁，请稍等约一分钟后再重新生成',
    );
  }
  if (err?.statusCode === 401 || err?.statusCode === 403) {
    return new AppError(503, 'service_unavailable', 'AI 服务凭证无效或未配置');
  }
  if (typeof err?.statusCode === 'number' && err.statusCode >= 500) {
    return new AppError(503, 'service_unavailable', '关系叙事服务暂时不可用，请稍后重试');
  }
  return new AppError(503, 'service_unavailable', '关系叙事服务暂时不可用，请稍后重试');
}

function buildAiContext(analysis) {
  return {
    playerA: analysis.playerA ?? { id: analysis.playerIdLow, name: null },
    playerB: analysis.playerB ?? { id: analysis.playerIdHigh, name: null },
    result: analysis.result,
    dataFreshness: analysis.dataFreshness ?? null,
  };
}

export class RelationshipNarrativeAgent {
  constructor({ aiRelationshipService = null } = {}) {
    this.aiRelationshipService = aiRelationshipService ?? createAiRelationshipService();
  }

  async generate({ analysis, userId = null }) {
    if (!analysis || analysis.status !== 'ready') {
      throw new AppError(409, 'analysis_not_ready', '球员对分析尚未就绪，请完成分析后再生成叙事');
    }
    if (!analysis.result || !analysis.id || !analysis.computedAt) {
      throw new AppError(409, 'analysis_not_ready', '球员对分析结论不完整');
    }

    let aiResult;
    try {
      aiResult = await this.aiRelationshipService.generateNarrative({
        context: buildAiContext(analysis),
        userId,
      });
    } catch (err) {
      throw mapAiError(err);
    }

    const parsed = parseNarrativeJson(aiResult.text);
    const playerNames = [
      analysis.playerA?.name,
      analysis.playerB?.name,
    ].filter(Boolean);

    const verified = verifyNarrativeOutput({
      result: analysis.result,
      narrative: parsed.narrative,
      claims: parsed.claims,
      playerNames,
    });

    if (!verified.ok) {
      throw new AppError(
        422,
        verified.errorCode ?? 'narrative_verification_failed',
        verified.reason ?? '叙事未通过事实核验，未采信',
      );
    }

    const saved = upsertReadyNarrative({
      playerIdLow: analysis.playerIdLow,
      playerIdHigh: analysis.playerIdHigh,
      analysisId: analysis.id,
      analysisComputedAt: analysis.computedAt,
      narrativeText: parsed.narrative,
      model: aiResult.model ?? null,
      promptVersion: promptVersion(),
      claims: parsed.claims ?? [],
      createdByUserId: userId,
    });

    return {
      status: 'ready',
      id: saved.id,
      playerIdLow: saved.playerIdLow,
      playerIdHigh: saved.playerIdHigh,
      analysisId: saved.analysisId,
      analysisComputedAt: saved.analysisComputedAt,
      narrativeText: saved.narrativeText,
      model: saved.model,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      aiGenerated: true,
      reused: false,
    };
  }
}

export function createRelationshipNarrativeAgent(overrides = {}) {
  return new RelationshipNarrativeAgent(overrides);
}
