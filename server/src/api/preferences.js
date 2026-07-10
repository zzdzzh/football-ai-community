import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getUserPreferences, updateUserPreferences } from '../services/preferences-service.js';

const router = Router();

router.get('/me/preferences', optionalAuth, requireAuth, (req, res, next) => {
  try {
    const preferences = getUserPreferences(req.user.id);
    res.status(200).json(preferences);
  } catch (err) {
    next(err);
  }
});

router.put('/me/preferences', optionalAuth, requireAuth, (req, res, next) => {
  try {
    const preferences = updateUserPreferences(req.user.id, req.body);
    res.status(200).json(preferences);
  } catch (err) {
    next(err);
  }
});

export default router;
