import { Router } from 'express';
import { getUserById, loginUser, registerUser } from '../services/auth-service.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res, next) => {
  try {
    const result = registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const result = loginUser(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', optionalAuth, requireAuth, (req, res, next) => {
  try {
    const user = getUserById(req.user.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
