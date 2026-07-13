import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { submitContentReport } from '../services/content-report-service.js';

const router = Router();

router.use(requireAuth);

router.post('/', (req, res, next) => {
  try {
    const { targetType, targetId, reason } = req.body ?? {};
    const report = submitContentReport({
      reporterUserId: req.user.id,
      targetType,
      targetId,
      reason,
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
