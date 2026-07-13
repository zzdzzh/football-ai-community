import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  addUserFanDiscussionTurn,
  createUserFanDiscussion,
  getUserFanDiscussion,
} from '../services/fan-discussion-service.js';

const router = Router();

router.use(requireAuth);

router.post('/', async (req, res, next) => {
  try {
    const { topic, personaIds, matchId } = req.body ?? {};
    const discussion = await createUserFanDiscussion({
      userId: req.user.id,
      topic,
      personaIds,
      matchId,
    });
    res.status(201).json(discussion);
  } catch (err) {
    next(err);
  }
});

router.get('/:discussionId', (req, res, next) => {
  try {
    const discussion = getUserFanDiscussion({
      discussionId: req.params.discussionId,
      userId: req.user.id,
    });
    res.status(200).json(discussion);
  } catch (err) {
    next(err);
  }
});

router.post('/:discussionId/turns', async (req, res, next) => {
  try {
    const { content } = req.body ?? {};
    const result = await addUserFanDiscussionTurn({
      discussionId: req.params.discussionId,
      userId: req.user.id,
      content,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
