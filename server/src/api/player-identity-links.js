import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { alignPlayerIdentities } from '../services/player-identity-align-service.js';

const router = Router();

router.use(requireAuth);

router.post('/align', (req, res, next) => {
  try {
    const result = alignPlayerIdentities({
      trigger: 'api',
      statsPlayerId: req.body?.statsPlayerId,
      careerPlayerId: req.body?.careerPlayerId,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
