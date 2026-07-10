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
  findMessageById,
} from '../db/repositories/message-repository.js';
import { upsertMessageFeedback } from '../db/repositories/message-feedback-repository.js';
import { createStatsAgent } from '../agents/stats-agent.js';
import { createScoutAgent } from '../agents/scout-agent.js';
import { createTacticalAgent } from '../agents/tactical-agent.js';
import { ALLOWED_LEAGUES, getLeagueDisplayName } from '../constants/league-codes.js';

function buildStatsConversationTitle({ contextType, contextId }) {
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

function buildScoutConversationTitle({ contextType, contextId }) {
  if (contextType === 'league') {
    return `${getLeagueDisplayName(contextId)} · 球员推荐`;
  }
  if (contextType === 'team') {
    const team = findTeamById(contextId);
    if (team) return `${team.name} · 球员推荐`;
  }
  return '球员推荐';
}

function buildTacticalConversationTitle({ contextType, contextId }) {
  if (contextType === 'match') {
    const match = findMatchById(contextId);
    if (match) {
      return `${match.homeTeam.name} vs ${match.awayTeam.name} · 战术分析`;
    }
  }
  if (contextType === 'team') {
    const team = findTeamById(contextId);
    if (team) return `${team.name} · 战术分析`;
  }
  return '战术分析';
}

function assertConversationOwner(conversation, userId) {
  if (conversation.userId !== userId) {
    throw new AppError(403, 'forbidden', '无权访问此对话');
  }
}

function validateTacticalContext({ contextType, contextId }) {
  if (contextType === 'match' && !findMatchById(contextId)) {
    throw new AppError(404, 'not_found', '比赛不存在');
  }
  if (contextType === 'team' && !findTeamById(contextId)) {
    throw new AppError(404, 'not_found', '球队不存在');
  }
  if (!['match', 'team'].includes(contextType)) {
    throw new AppError(400, 'bad_request', 'Tactical 仅支持 match/team 上下文');
  }
}

function validateStatsContext({ contextType, contextId }) {
  if (contextType === 'match' && !findMatchById(contextId)) {
    throw new AppError(404, 'not_found', '比赛不存在');
  }
  if (contextType === 'team' && !findTeamById(contextId)) {
    throw new AppError(404, 'not_found', '球队不存在');
  }
}

function validateScoutContext({ contextType, contextId }) {
  if (contextType === 'league') {
    if (!contextId || !ALLOWED_LEAGUES.includes(contextId)) {
      throw new AppError(404, 'not_found', '联赛不存在');
    }
    return;
  }
  if (contextType === 'team' && !findTeamById(contextId)) {
    throw new AppError(404, 'not_found', '球队不存在');
  }
}

function formatMessageForApi(message, agentId) {
  const base = {
    id: message.id,
    role: message.role,
    content: message.content,
    confidence: message.confidence,
    missingFields: message.missingFields,
    createdAt: message.createdAt,
  };
  if (agentId === 'scout' && message.role === 'assistant') {
    return {
      ...base,
      recommendations: message.recommendations,
      narrowHint: message.metrics?.find?.((m) => m.name === 'narrowHint')?.value ?? undefined,
    };
  }
  if (agentId === 'tactical' && message.role === 'assistant') {
    return {
      ...base,
      tacticalAnalysis: message.tacticalAnalysis,
    };
  }
  if (agentId === 'stats') {
    return {
      ...base,
      metrics: message.metrics,
    };
  }
  return base;
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
  const messages = listMessagesByConversationId(conversationId)
    .map((msg) => formatMessageForApi(msg, conversation.agentId));
  return { ...conversation, messages };
}

export async function createUserConversation({
  userId,
  agentId,
  contextType,
  contextId = null,
  initialMessage = null,
  statsAgent = null,
  scoutAgent = null,
  tacticalAgent = null,
}) {
  if (!['stats', 'scout', 'tactical'].includes(agentId)) {
    throw new AppError(400, 'bad_request', `不支持的 Agent: ${agentId}`);
  }

  if (agentId === 'stats') {
    if ((contextType === 'match' || contextType === 'team') && !contextId) {
      throw new AppError(400, 'bad_request', 'match/team 上下文需要 contextId');
    }
    if (contextType !== 'general') {
      validateStatsContext({ contextType, contextId });
    }
  }

  if (agentId === 'tactical') {
    if (!contextId) {
      throw new AppError(400, 'bad_request', 'match/team 上下文需要 contextId');
    }
    validateTacticalContext({ contextType, contextId });
  }

  if (agentId === 'scout') {
    if ((contextType === 'league' || contextType === 'team') && !contextId) {
      throw new AppError(400, 'bad_request', 'league/team 上下文需要 contextId');
    }
    if (contextType !== 'general') {
      validateScoutContext({ contextType, contextId });
    }
  }

  let title;
  if (agentId === 'scout') {
    title = buildScoutConversationTitle({ contextType, contextId });
  } else if (agentId === 'tactical') {
    title = buildTacticalConversationTitle({ contextType, contextId });
  } else {
    title = buildStatsConversationTitle({ contextType, contextId });
  }

  const conversation = createConversation({
    userId,
    agentId,
    contextType,
    contextId,
    title,
  });

  if (!initialMessage) {
    return { ...conversation, messages: [] };
  }

  await sendConversationMessage({
    conversationId: conversation.id,
    userId,
    content: initialMessage,
    statsAgent,
    scoutAgent,
    tacticalAgent,
  });

  return getConversationDetail({ conversationId: conversation.id, userId });
}

export async function sendConversationMessage({
  conversationId,
  userId,
  content,
  statsAgent = null,
  scoutAgent = null,
  tacticalAgent = null,
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

  let assistantMessage;
  try {
    if (conversation.agentId === 'stats') {
      const agent = statsAgent ?? createStatsAgent();
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
    } else if (conversation.agentId === 'scout') {
      const agent = scoutAgent ?? createScoutAgent();
      const reply = await agent.handleQuestion({
        contextType: conversation.contextType,
        contextId: conversation.contextId,
        userQuestion: content,
        userId,
      });
      const metrics = [...(reply.metrics ?? [])];
      if (reply.narrowHint) {
        metrics.push({ name: 'narrowHint', value: reply.narrowHint });
      }
      assistantMessage = createMessage({
        conversationId,
        role: 'assistant',
        content: reply.content,
        recommendations: reply.recommendations,
        confidence: reply.confidence,
        metrics,
      });
    } else if (conversation.agentId === 'tactical') {
      const agent = tacticalAgent ?? createTacticalAgent();
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
        tacticalAnalysis: reply.tacticalAnalysis,
        confidence: reply.confidence,
        missingFields: reply.missingFields,
      });
    } else {
      throw new AppError(400, 'bad_request', '不支持的 Agent');
    }
  } catch (err) {
    if (err.statusCode === 408) {
      throw new AppError(408, 'timeout', err.message);
    }
    throw err;
  }

  touchConversationUpdatedAt(conversationId);
  return {
    userMessage: formatMessageForApi(userMessage, conversation.agentId),
    assistantMessage: formatMessageForApi(assistantMessage, conversation.agentId),
  };
}

export function submitMessageFeedback({
  conversationId,
  messageId,
  userId,
  helpful,
}) {
  const conversation = findConversationById(conversationId);
  if (!conversation) {
    throw new AppError(404, 'not_found', '对话不存在');
  }
  assertConversationOwner(conversation, userId);

  if (!['scout', 'tactical'].includes(conversation.agentId)) {
    throw new AppError(403, 'forbidden', '该对话不支持消息反馈');
  }

  const message = findMessageById(messageId);
  if (!message || message.conversationId !== conversationId) {
    throw new AppError(404, 'not_found', '消息不存在');
  }
  if (message.role !== 'assistant') {
    throw new AppError(403, 'forbidden', '仅可对 assistant 消息提交反馈');
  }

  const feedback = upsertMessageFeedback({ userId, messageId, helpful });
  return {
    messageId,
    helpful: feedback.helpful,
    recordedAt: feedback.createdAt,
  };
}
