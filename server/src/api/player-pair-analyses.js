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

const router = Router();

router.use(requireAuth);

function assertNotSelfPair(playerIdA, playerIdB) {
  if (playerIdA === playerIdB) {
    throw new AppError(400, 'bad_request', '不能分析同一球员');
  }
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

function buildDataFreshness(playerA, playerB, usedCacheOnly = false) {
  return {
    playerASyncedAt: playerA.syncedAt ?? null,
    playerBSyncedAt: playerB.syncedAt ?? null,
    summary: `已基于 ${playerA.name} 与 ${playerB.name} 的本地履历进行分析`,
    usedCacheOnly,
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

function analyzePair(playerIdA, playerIdB, { forceRecompute = false, usedCacheOnly = false } = {}) {
  assertNotSelfPair(playerIdA, playerIdB);
  const { playerA, playerB } = loadPlayerPair(playerIdA, playerIdB);

  if (!forceRecompute) {
    const cached = findPlayerPairAnalysis(playerIdA, playerIdB);
    if (cached?.result) {
      return buildResponse(
        playerIdA,
        playerIdB,
        cached,
        buildDataFreshness(playerA, playerB, true),
      );
    }
  }

  const result = computeAnalysisResult(playerA, playerB);
  const dataFreshness = buildDataFreshness(playerA, playerB, usedCacheOnly);
  const analysis = persistAnalysis(playerA, playerB, result, dataFreshness);
  return buildResponse(playerIdA, playerIdB, analysis, dataFreshness);
}

router.get('/:playerIdA/:playerIdB', (req, res, next) => {
  try {
    const { playerIdA, playerIdB } = req.params;
    const response = analyzePair(playerIdA, playerIdB);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { playerIdA, playerIdB } = req.body ?? {};
    if (!playerIdA || !playerIdB) {
      throw new AppError(400, 'bad_request', '缺少球员 ID');
    }
    const response = analyzePair(playerIdA, playerIdB, { forceRecompute: true });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
