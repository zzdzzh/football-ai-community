import { AppError } from '../middleware/error.js';
import { findMatchById } from '../db/repositories/match-repository.js';
import { findTeamById } from '../db/repositories/team-repository.js';
import {
  createConversation,
  findConversationById,
  listConversationsByUser,
  touchConversationUpdatedAt,
} from '../db/repositories/conversation-repository.js';
import {
  createMessage,
  listMessagesByConversationId,
} from '../db/repositories/message-repository.js';
import { createStatsAgent } from '../agents/stats-agent.js';

function buildConversationTitle({ contextType, contextId }) {
  if (contextType === 'match') {
    const match = findMatchById(contextId);
    if (match) {
      return `${match.homeTeam.name} vs ${match.awayTeam.name} · 数据问答`;
    }
  }
  if (contextType === 'team') {
    const team = findTeamById(contextId);
    if (team) return `${team.name} · 数据问答`;
  }
  return 'Stats 数据问答';
}

function assertConversationOwner(conversation, userId) {
  if (conversation.userId !== userId) {
    throw new AppError(403, 'forbidden', '无权访问此对话');
  }
}

function validateContext({ contextType, contextId }) {
  if (contextType === 'match' && !findMatchById(contextId)) {
    throw new AppError(404, 'not_found', '比赛不存在');
  }
  if (contextType === 'team' && !findTeamById(contextId)) {
    throw new AppError(404, 'not_found', '球队不存在');
  }
}

export function listUserConversations({ userId, agentId = 'stats', page, pageSize }) {
  return listConversationsByUser({ userId, agentId, page, pageSize });
}

export function getConversationDetail({ conversationId, userId }) {
  const conversation = findConversationById(conversationId);
  if (!conversation) {
    throw new AppError(404, 'not_found', '对话不存在');
  }
  assertConversationOwner(conversation, userId);
  const messages = listMessagesByConversationId(conversationId);
  return { ...conversation, messages };
}

export async function createUserConversation({
  userId,
  agentId,
  contextType,
  contextId = null,
  initialMessage = null,
  statsAgent = null,
}) {
  if (agentId !== 'stats') {
    throw new AppError(400, 'bad_request', '仅支持 stats Agent');
  }
  if ((contextType === 'match' || contextType === 'team') && !contextId) {
    throw new AppError(400, 'bad_request', 'match/team 上下文需要 contextId');
  }
  if (contextType !== 'general') {
    validateContext({ contextType, contextId });
  }

  const conversation = createConversation({
    userId,
    agentId,
    contextType,
    contextId,
    title: buildConversationTitle({ contextType, contextId }),
  });

  if (!initialMessage) {
    return { ...conversation, messages: [] };
  }

  const agent = statsAgent ?? createStatsAgent();
  const { userMessage, assistantMessage } = await sendConversationMessage({
    conversationId: conversation.id,
    userId,
    content: initialMessage,
    statsAgent: agent,
  });

  return getConversationDetail({ conversationId: conversation.id, userId: userId });
}

export async function sendConversationMessage({
  conversationId,
  userId,
  content,
  statsAgent = null,
}) {
  const conversation = findConversationById(conversationId);
  if (!conversation) {
    throw new AppError(404, 'not_found', '对话不存在');
  }
  assertConversationOwner(conversation, userId);

  const userMessage = createMessage({
    conversationId,
    role: 'user',
    content,
  });

  const agent = statsAgent ?? createStatsAgent();
  let assistantMessage;
  try {
    const reply = await agent.handleQuestion({
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      userQuestion: content,
      userId,
    });
    assistantMessage = createMessage({
      conversationId,
      role: 'assistant',
      content: reply.content,
      metrics: reply.metrics,
      confidence: reply.confidence,
      missingFields: reply.missingFields,
    });
  } catch (err) {
    if (err.statusCode === 408) {
      throw new AppError(408, 'timeout', 'Stats Agent 响应超时');
    }
    throw err;
  }

  touchConversationUpdatedAt(conversationId);
  return { userMessage, assistantMessage };
}
