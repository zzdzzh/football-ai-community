import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listUserConversations,
  getConversationDetail,
  createUserConversation,
  sendConversationMessage,
} from '../services/conversation-service.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
    const agentId = req.query.agentId ?? 'stats';
    const result = listUserConversations({
      userId: req.user.id,
      agentId,
      page,
      pageSize,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { agentId, contextType, contextId, initialMessage } = req.body ?? {};
    const conversation = await createUserConversation({
      userId: req.user.id,
      agentId,
      contextType,
      contextId,
      initialMessage,
    });
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

router.get('/:conversationId', (req, res, next) => {
  try {
    const conversation = getConversationDetail({
      conversationId: req.params.conversationId,
      userId: req.user.id,
    });
    res.status(200).json(conversation);
  } catch (err) {
    next(err);
  }
});

router.post('/:conversationId/messages', async (req, res, next) => {
  try {
    const { content } = req.body ?? {};
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'bad_request', message: '消息内容不能为空' });
    }
    const result = await sendConversationMessage({
      conversationId: req.params.conversationId,
      userId: req.user.id,
      content: content.trim(),
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
