import { Router } from 'express';
import { AppError } from '../middleware/error.js';
import { listMatchSummaries, getMatchDetail } from '../services/match-service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const result = listMatchSummaries({
      league: req.query.league ?? null,
      status: req.query.status ?? null,
      teamId: req.query.teamId ?? null,
      dateFrom: req.query.dateFrom ?? null,
      dateTo: req.query.dateTo ?? null,
      page,
      pageSize,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:matchId', (req, res, next) => {
  try {
    const match = getMatchDetail(req.params.matchId);
    if (!match) {
      throw new AppError(404, 'not_found', '比赛不存在');
    }
    res.status(200).json(match);
  } catch (err) {
    next(err);
  }
});

export default router;
