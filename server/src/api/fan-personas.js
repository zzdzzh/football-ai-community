import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listFanPersonas } from '../db/repositories/fan-persona-repository.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    const items = listFanPersonas({
      league: req.query.league ?? null,
      teamId: req.query.teamId ?? null,
    });
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;
