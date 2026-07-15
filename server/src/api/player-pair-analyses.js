import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { config } from '../config/index.js';
import { findCareerPlayerById } from '../db/repositories/career-player-repository.js';
import { findCareerClubById } from '../db/repositories/career-club-repository.js';
import { listClubStintsByPlayerId } from '../db/repositories/club-stint-repository.js';
import { listNationalTeamStintsByPlayerId } from '../db/repositories/national-team-stint-repository.js';
import {
  findPlayerPairAnalysis,
  upsertPlayerPairAnalysis,
} from '../db/repositories/player-pair-analysis-repository.js';
import { analyzeDirectRelations } from '../services/relationship-analysis-service.js';
import { careerSyncService } from '../services/career-sync-service.js';

const router = Router();

router.use(requireAuth);

/** @type {Map<string, Promise<unknown>>} */
const playerSyncInflight = new Map();

function assertNotSelfPair(playerIdA, playerIdB) {
  if (playerIdA === playerIdB) {
    throw new AppError(400, 'bad_request', '不能分析同一球员');
  }
}

function clubStintCount(playerId) {
  return listClubStintsByPlayerId(playerId).length;
}

/**
 * @returns {'ok'|'wait'|'start'|'failed'}
 */
function getSyncGate(player, { force = false } = {}) {
  if (!player) return 'failed';
  if (player.syncStatus === 'syncing') return 'wait';

  const clubs = clubStintCount(player.id);
  if (clubs > 0 && player.syncedAt && player.syncStatus === 'ready' && !force) {
    return 'ok';
  }
  if (clubs > 0 && !force && (player.syncStatus === 'stale' || player.syncStatus === 'ready')) {
    // 有本地效力段时可先用缓存分析
    return 'ok';
  }
  if (player.syncStatus === 'failed' && clubs === 0 && !force) {
    return 'failed';
  }
  if (force || clubs === 0 || !player.syncedAt || player.syncStatus === 'stale' || player.syncStatus === 'failed') {
    return 'start';
  }
  return 'ok';
}

function kickoffPlayerSync(playerId) {
  const existing = playerSyncInflight.get(playerId);
  if (existing) return existing;

  const promise = careerSyncService
    .syncPlayer({ playerId, force: true })
    .catch((err) => {
      console.error(JSON.stringify({
        level: 'error',
        type: 'career_sync_background_failed',
        playerId,
        message: err?.message ?? String(err),
      }));
      return null;
    })
    .finally(() => {
      playerSyncInflight.delete(playerId);
    });

  playerSyncInflight.set(playerId, promise);
  return promise;
}

function loadPlayerWithStints(playerId) {
  const player = findCareerPlayerById(playerId);
  if (!player) return null;

  const clubStints = listClubStintsByPlayerId(playerId).map((stint) => {
    const club = findCareerClubById(stint.clubId);
    return {
      ...stint,
      clubName: club?.name ?? 'Unknown Club',
    };
  });

  const nationalTeamStints = listNationalTeamStintsByPlayerId(playerId);

  return { ...player, clubStints, nationalTeamStints };
}

function loadPlayerPair(playerIdA, playerIdB) {
  const playerA = loadPlayerWithStints(playerIdA);
  const playerB = loadPlayerWithStints(playerIdB);
  if (!playerA || !playerB) {
    throw new AppError(404, 'not_found', '球员不存在');
  }
  return { playerA, playerB };
}

function computeSuccessiveSameClub(clubStintsA, clubStintsB) {
  const clubIdsB = new Set(clubStintsB.map((stint) => stint.clubId));
  return clubStintsA.some((stint) => clubIdsB.has(stint.clubId));
}

function buildDataFreshness(playerA, playerB, usedCacheOnly = false, summary) {
  return {
    playerASyncedAt: playerA.syncedAt ?? null,
    playerBSyncedAt: playerB.syncedAt ?? null,
    summary: summary ?? `已基于 ${playerA.name} 与 ${playerB.name} 的本地履历进行分析`,
    usedCacheOnly,
  };
}

function buildComputingResponse(playerIdA, playerIdB, playerA, playerB) {
  return {
    status: 'computing',
    analysisId: null,
    playerIdA,
    playerIdB,
    computedAt: null,
    dataFreshness: buildDataFreshness(
      playerA,
      playerB,
      false,
      '正在从 Transfermarkt 同步球员履历，请稍候…',
    ),
    result: null,
  };
}

function buildFailedResponse(playerIdA, playerIdB, playerA, playerB, message) {
  return {
    status: 'failed',
    analysisId: null,
    playerIdA,
    playerIdB,
    computedAt: null,
    dataFreshness: buildDataFreshness(playerA, playerB, false, '履历同步失败'),
    result: null,
    error: message || '履历同步失败，请稍后重试',
  };
}

function computeAnalysisResult(playerA, playerB) {
  const direct = analyzeDirectRelations({
    playerA: {
      id: playerA.id,
      clubStints: playerA.clubStints,
      nationalTeamStints: playerA.nationalTeamStints,
    },
    playerB: {
      id: playerB.id,
      clubStints: playerB.clubStints,
      nationalTeamStints: playerB.nationalTeamStints,
    },
  });

  return {
    ...direct,
    transfer: {
      directTransferLink: false,
      successiveSameClub: computeSuccessiveSameClub(playerA.clubStints, playerB.clubStints),
      evidence: [],
    },
    pathStatus: 'skipped',
    relationDistance: null,
    indirectPath: null,
  };
}

function buildResponse(playerIdA, playerIdB, analysis, dataFreshness) {
  return {
    status: 'ready',
    analysisId: analysis.id,
    playerIdA,
    playerIdB,
    computedAt: analysis.computedAt,
    dataFreshness,
    result: analysis.result,
  };
}

function persistAnalysis(playerA, playerB, result, dataFreshness) {
  const existing = findPlayerPairAnalysis(playerA.id, playerB.id);
  return upsertPlayerPairAnalysis({
    id: existing?.id,
    playerIdLow: playerA.id,
    playerIdHigh: playerB.id,
    result,
    dataFreshness,
    maxHops: config.relationship.maxHops,
  });
}

async function analyzePair(playerIdA, playerIdB, { forceRecompute = false } = {}) {
  assertNotSelfPair(playerIdA, playerIdB);

  const metaA = findCareerPlayerById(playerIdA);
  const metaB = findCareerPlayerById(playerIdB);
  if (!metaA || !metaB) {
    throw new AppError(404, 'not_found', '球员不存在');
  }

  const gateA = getSyncGate(metaA, { force: forceRecompute });
  const gateB = getSyncGate(metaB, { force: forceRecompute });

  if (gateA === 'failed' || gateB === 'failed') {
    return buildFailedResponse(
      playerIdA,
      playerIdB,
      metaA,
      metaB,
      '球员履历同步失败且本地无可用效力段，请重试',
    );
  }

  if (gateA === 'start') kickoffPlayerSync(playerIdA);
  if (gateB === 'start') kickoffPlayerSync(playerIdB);

  if (gateA === 'start' || gateB === 'start' || gateA === 'wait' || gateB === 'wait') {
    return buildComputingResponse(playerIdA, playerIdB, metaA, metaB);
  }

  const { playerA, playerB } = loadPlayerPair(playerIdA, playerIdB);

  if (!forceRecompute) {
    const cached = findPlayerPairAnalysis(playerIdA, playerIdB);
    if (cached?.result) {
      const aSynced = playerA.syncedAt ? Date.parse(playerA.syncedAt) : 0;
      const bSynced = playerB.syncedAt ? Date.parse(playerB.syncedAt) : 0;
      const computed = cached.computedAt ? Date.parse(cached.computedAt) : 0;
      if (computed >= aSynced && computed >= bSynced) {
        return buildResponse(
          playerIdA,
          playerIdB,
          cached,
          buildDataFreshness(playerA, playerB, true),
        );
      }
    }
  }

  const result = computeAnalysisResult(playerA, playerB);
  const dataFreshness = buildDataFreshness(playerA, playerB, false);
  const analysis = persistAnalysis(playerA, playerB, result, dataFreshness);
  return buildResponse(playerIdA, playerIdB, analysis, dataFreshness);
}

router.get('/:playerIdA/:playerIdB', async (req, res, next) => {
  try {
    const { playerIdA, playerIdB } = req.params;
    const response = await analyzePair(playerIdA, playerIdB);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { playerIdA, playerIdB } = req.body ?? {};
    if (!playerIdA || !playerIdB) {
      throw new AppError(400, 'bad_request', '缺少球员 ID');
    }
    const response = await analyzePair(playerIdA, playerIdB, { forceRecompute: true });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
