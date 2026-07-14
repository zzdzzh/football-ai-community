import { AppError } from '../middleware/error.js';
import { buildScoutContext } from '../services/scout-context-builder.js';
import { composeKeyStats } from '../services/scout-key-stats.js';
import { createAiScoutService } from '../ai/ai-scout-service.js';

function isCurrentSeasonLabel(season) {
  return typeof season === 'string' && /^\d{2}-\d{2}$/.test(season);
}

function appendSeasonNote(matchReason, player, candidates) {
  const reason = matchReason ?? '';
  if (!player?.statsSeasonLabel) return reason;
  const seasons = candidates
    .map((c) => c.statsSeason)
    .filter(Boolean);
  const hasCurrent = seasons.some((s) => isCurrentSeasonLabel(s));
  const isHistorical = !isCurrentSeasonLabel(player.statsSeason);
  // 候选池里已有当前赛季数据，但此人用了历史赛季 → 必须说明
  if (!(hasCurrent && isHistorical)) return reason;
  if (reason.includes(player.statsSeasonLabel) || reason.includes('赛季')) return reason;
  const note = `（统计来自${player.statsSeasonLabel}，非当前赛季）`;
  return reason ? `${reason}${note}` : note;
}

function enrichRecommendation(rec, candidates, preferredStatNames = []) {
  const player = candidates.find((c) => c.id === rec.playerId);
  const aiKeyStats = Array.isArray(rec.keyStats) ? rec.keyStats : [];
  const keyStats = player
    ? composeKeyStats(aiKeyStats, player.stats ?? [], preferredStatNames)
    : aiKeyStats;
  return {
    playerId: rec.playerId,
    playerName: player?.name ?? rec.playerId,
    teamName: player?.teamName ?? '',
    position: player?.position,
    statsSeason: player?.statsSeason ?? null,
    statsSeasonLabel: player?.statsSeasonLabel ?? null,
    matchReason: appendSeasonNote(rec.matchReason ?? '', player, candidates),
    keyStats,
  };
}

export class ScoutAgent {
  constructor({ aiScoutService = null } = {}) {
    this.aiScoutService = aiScoutService ?? createAiScoutService();
  }

  async handleQuestion({ contextType, contextId, userQuestion, userId = null }) {
    const context = buildScoutContext({ contextType, contextId, userQuestion });

    if (context.notFound) {
      throw new AppError(404, 'not_found', '上下文资源不存在');
    }
    if (context.invalid) {
      throw new AppError(400, 'bad_request', '无效的上下文类型');
    }
    if (context.syncMessage) {
      throw new AppError(503, 'service_unavailable', context.syncMessage);
    }
    if (context.candidates.length === 0) {
      throw new AppError(503, 'service_unavailable', '暂无符合条件的候选球员，请稍后再试或调整筛选范围');
    }

    const preferredStatNames = context.filters?.statFocus?.preferredStatNames ?? [];

    try {
      const reply = await this.aiScoutService.recommend({
        question: userQuestion,
        filters: context.filters,
        candidates: context.candidates,
        userId,
      });

      let recommendations = reply.recommendations.map((rec) => (
        enrichRecommendation(rec, context.candidates, preferredStatNames)
      ));
      let narrowHint = reply.narrowHint ?? null;

      if (context.tooBroad && recommendations.length > 5) {
        recommendations = recommendations.slice(0, 5);
        narrowHint = narrowHint ?? '符合条件的球员较多，请补充位置、年龄或联赛范围以缩小推荐';
      }

      return {
        content: reply.summary,
        recommendations,
        confidence: reply.confidence ?? 'medium',
        narrowHint,
        metrics: [{ name: '候选池', value: context.poolSize }],
      };
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.statusCode === 408) {
        throw new AppError(408, 'timeout', 'Scout Agent 响应超时');
      }
      throw err;
    }
  }
}

export function createScoutAgent(overrides = {}) {
  return new ScoutAgent(overrides);
}
