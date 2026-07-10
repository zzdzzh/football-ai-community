import { Router } from 'express';
import { AppError } from '../middleware/error.js';
import { searchTeamSummaries, getTeamDetail } from '../services/team-service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const result = searchTeamSummaries({
      q: req.query.q ?? null,
      league: req.query.league ?? null,
      page,
      pageSize,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:teamId', (req, res, next) => {
  try {
    const team = getTeamDetail(req.params.teamId);
    if (!team) {
      throw new AppError(404, 'not_found', '球队不存在');
    }
    res.status(200).json(team);
  } catch (err) {
    next(err);
  }
});

export default router;
