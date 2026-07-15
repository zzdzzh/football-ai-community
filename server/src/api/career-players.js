import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import {
  findCareerPlayerById,
  searchCareerPlayers,
  upsertCareerPlayer,
} from '../db/repositories/career-player-repository.js';
import { findCareerClubById, upsertCareerClub } from '../db/repositories/career-club-repository.js';
import { listClubStintsByPlayerId } from '../db/repositories/club-stint-repository.js';
import { listNationalTeamStintsByPlayerId } from '../db/repositories/national-team-stint-repository.js';
import { careerSyncService } from '../services/career-sync-service.js';

const router = Router();

router.use(requireAuth);

function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toCandidate(player) {
  return {
    id: player.id,
    name: player.name,
    dateOfBirth: player.dateOfBirth ?? null,
    nationality: player.nationality ?? null,
    currentClubName: player.currentClubName ?? null,
    primaryClubHint: player.currentClubName ?? null,
    externalId: player.externalId ?? null,
  };
}

function ensureClubFromHint(clubName) {
  if (!clubName) return null;
  const externalId = `hash:${normalizeName(clubName)}`;
  return upsertCareerClub({
    externalSource: 'transfermarkt',
    externalId,
    name: clubName,
    nameNormalized: normalizeName(clubName),
  });
}

function upsertExternalCandidates(items) {
  for (const item of items) {
    const clubHint = item.currentClubName ?? item.primaryClubHint;
    const club = ensureClubFromHint(clubHint);
    upsertCareerPlayer({
      externalSource: item.externalSource ?? 'transfermarkt',
      externalId: item.externalId,
      name: item.name,
      nameNormalized: normalizeName(item.name),
      dateOfBirth: item.dateOfBirth ?? null,
      currentClubId: club?.id ?? null,
      currentClubName: clubHint ?? null,
      syncStatus: 'stale',
    });
  }
}

function buildCareerPlayerDetail(player) {
  const clubStints = listClubStintsByPlayerId(player.id).map((stint) => {
    const club = findCareerClubById(stint.clubId);
    return {
      id: stint.id,
      clubId: stint.clubId,
      clubName: club?.name ?? '',
      joinedOn: stint.joinedOn ?? null,
      leftOn: stint.leftOn ?? null,
      joinedRaw: stint.joinedRaw ?? null,
      leftRaw: stint.leftRaw ?? null,
      timePrecision: stint.timePrecision,
      transferType: stint.transferType ?? null,
      transferFee: stint.transferFee ?? null,
    };
  });

  const nationalTeamStints = listNationalTeamStintsByPlayerId(player.id).map((stint) => ({
    id: stint.id,
    nationKey: stint.nationKey,
    nationName: stint.nationName,
    joinedOn: stint.joinedOn ?? null,
    leftOn: stint.leftOn ?? null,
    timePrecision: stint.timePrecision,
  }));

  return {
    id: player.id,
    name: player.name,
    dateOfBirth: player.dateOfBirth ?? null,
    nationality: player.nationality ?? null,
    position: player.position ?? null,
    currentClubName: player.currentClubName ?? null,
    syncedAt: player.syncedAt ?? null,
    syncStatus: player.syncStatus,
    lastSyncError: player.lastSyncError ?? null,
    clubStints,
    nationalTeamStints,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 1 || q.length > 100) {
      throw new AppError(400, 'bad_request', '搜索关键字无效');
    }

    const limitRaw = req.query.limit;
    let limit = limitRaw === undefined ? 10 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new AppError(400, 'bad_request', 'limit 无效');
    }

    let sourceNote = 'local_only';
    let result = searchCareerPlayers({ q, page: 1, pageSize: limit });

    if (result.items.length === 0) {
      let externalError = null;
      let usedExternal = false;
      try {
        const external = await careerSyncService.searchExternal(q, { limit });
        const items = Array.isArray(external?.items) ? external.items : [];
        if (items.length > 0) {
          usedExternal = true;
          upsertExternalCandidates(items);
        }
      } catch (err) {
        externalError = err;
      }

      result = searchCareerPlayers({ q, page: 1, pageSize: limit });

      if (result.items.length === 0 && externalError) {
        throw new AppError(503, 'service_unavailable', '履历搜索服务暂不可用');
      }

      if (usedExternal) {
        sourceNote = result.items.length > 0 ? 'external' : 'mixed';
      }
    }

    res.status(200).json({
      items: result.items.map(toCandidate),
      sourceNote,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:playerId', (req, res, next) => {
  try {
    const player = findCareerPlayerById(req.params.playerId);
    if (!player) {
      throw new AppError(404, 'not_found', '球员不存在');
    }
    res.status(200).json(buildCareerPlayerDetail(player));
  } catch (err) {
    next(err);
  }
});

router.post('/:playerId/sync', async (req, res, next) => {
  try {
    const player = findCareerPlayerById(req.params.playerId);
    if (!player) {
      throw new AppError(404, 'not_found', '球员不存在');
    }

    try {
      await careerSyncService.syncPlayer({ playerId: player.id, force: true });
    } catch (err) {
      if (err?.code === 'CAREER_SYNC_FAILED') {
        throw new AppError(503, 'service_unavailable', err.message);
      }
      throw err;
    }

    const updated = findCareerPlayerById(player.id);
    res.status(200).json(buildCareerPlayerDetail(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
