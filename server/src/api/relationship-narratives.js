import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateRelationshipNarrative,
  getRelationshipNarrative,
} from '../services/relationship-narrative-service.js';

const router = Router();

router.use(requireAuth);

function resolveTestMode(req) {
  if (process.env.NODE_ENV !== 'test') return null;
  const mode = req.get('X-Test-Narrative-Mode');
  return mode || null;
}

router.get('/:playerIdA/:playerIdB/narrative', async (req, res, next) => {
  try {
    const { playerIdA, playerIdB } = req.params;
    const body = await getRelationshipNarrative({
      playerIdA,
      playerIdB,
      userId: req.user?.id,
    });
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});

router.post('/:playerIdA/:playerIdB/narrative', async (req, res, next) => {
  try {
    const { playerIdA, playerIdB } = req.params;
    const force = Boolean(req.body?.force);
    const body = await generateRelationshipNarrative({
      playerIdA,
      playerIdB,
      userId: req.user?.id,
      force,
      testMode: resolveTestMode(req),
    });
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});

export default router;
