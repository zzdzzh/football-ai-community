import { Router } from 'express';
import { getFeedDetail, listFeed } from '../services/feed-service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const agentId = req.query.agentId || null;
    const result = listFeed({
      page,
      pageSize,
      agentId,
      userId: req.user?.id ?? null,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:feedId', (req, res, next) => {
  try {
    const item = getFeedDetail(req.params.feedId);
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
