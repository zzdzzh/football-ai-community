import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { searchPlayerSummaries, getPlayerDetail } from '../services/player-service.js';
import { getAggregatePlayerSyncStatus } from '../db/repositories/player-sync-meta-repository.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    const { status } = getAggregatePlayerSyncStatus();
    if (status === 'down') {
      throw new AppError(503, 'service_unavailable', '球员数据同步暂不可用，请稍后再试');
    }

    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const result = searchPlayerSummaries({
      league: req.query.league ?? null,
      teamId: req.query.teamId ?? null,
      position: req.query.position ?? null,
      q: req.query.q ?? null,
      page,
      pageSize,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:playerId', (req, res, next) => {
  try {
    const player = getPlayerDetail(req.params.playerId);
    if (!player) {
      throw new AppError(404, 'not_found', '球员不存在');
    }
    res.status(200).json(player);
  } catch (err) {
    next(err);
  }
});

export default router;
