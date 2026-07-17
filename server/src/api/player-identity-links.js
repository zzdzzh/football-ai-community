import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { alignPlayerIdentities } from '../services/player-identity-align-service.js';
import {
  listLinkStatusByCareerPlayerIds,
  resolvePlayerIdentityLink,
} from '../services/player-identity-resolve-service.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    const raw = req.query.careerPlayerIds;
    if (raw == null || String(raw).trim() === '') {
      throw new AppError(400, 'bad_request', 'careerPlayerIds 为必填');
    }
    const ids = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      throw new AppError(400, 'bad_request', 'careerPlayerIds 不能为空');
    }
    if (ids.length > 20) {
      throw new AppError(400, 'bad_request', 'careerPlayerIds 最多 20 个');
    }
    res.status(200).json(listLinkStatusByCareerPlayerIds(ids));
  } catch (err) {
    next(err);
  }
});

router.get('/resolve', (req, res, next) => {
  try {
    const result = resolvePlayerIdentityLink({
      statsPlayerId: req.query.statsPlayerId,
      careerPlayerId: req.query.careerPlayerId,
    });
    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : 400;
      throw new AppError(status, result.code === 'not_found' ? 'not_found' : 'bad_request', result.message);
    }
    res.status(200).json(result.link);
  } catch (err) {
    next(err);
  }
});

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
