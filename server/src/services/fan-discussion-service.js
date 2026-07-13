import { AppError } from '../middleware/error.js';
import { FAN_DISCLAIMER, createFanAgent } from '../agents/fan-agent.js';
import { findFanPersonasByIds } from '../db/repositories/fan-persona-repository.js';
import {
  createFanDiscussion,
  createFanDiscussionTurn,
  findFanDiscussionById,
  findFanDiscussionTurnById,
  getNextTurnSequence,
  linkDiscussionPersonas,
  listDiscussionPersonaIds,
  listFanDiscussionTurns,
  runFanDiscussionTransaction,
  updateFanDiscussion,
} from '../db/repositories/fan-discussion-repository.js';
import { publishFanDiscussionFeedItem } from './feed-service.js';

function mapPublicTurn(turn) {
  return {
    id: turn.id,
    sequence: turn.sequence,
    role: turn.role,
    personaId: turn.personaId ?? null,
    personaDisplayName: turn.personaDisplayName ?? null,
    teamName: turn.teamName ?? null,
    userId: turn.userId ?? null,
    content: turn.content,
    isHidden: turn.isHidden,
    createdAt: turn.createdAt,
  };
}

export function buildFanDiscussionDetail(discussionId) {
  const discussion = findFanDiscussionById(discussionId);
  if (!discussion) {
    throw new AppError(404, 'not_found', '讨论不存在');
  }

  const personaIds = listDiscussionPersonaIds(discussionId);
  const personas = findFanPersonasByIds(personaIds);
  const turns = listFanDiscussionTurns(discussionId);

  return {
    id: discussion.id,
    topic: discussion.topic,
    matchId: discussion.matchId,
    status: discussion.status,
    personas,
    turns: turns.map(mapPublicTurn),
    turnCount: discussion.turnCount,
    feedItemId: discussion.feedItemId,
    disclaimer: FAN_DISCLAIMER,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
  };
}

function assertDiscussionReadable(discussion, userId) {
  if (discussion.status === 'hidden' && discussion.userId !== userId) {
    throw new AppError(403, 'forbidden', '讨论已隐藏');
  }
}

function assertDiscussionOwner(discussion, userId) {
  if (discussion.userId !== userId) {
    throw new AppError(403, 'forbidden', '无权操作该讨论');
  }
  if (discussion.status !== 'active') {
    throw new AppError(403, 'forbidden', '讨论已关闭或隐藏');
  }
}

function buildHistoryFromTurns(turns) {
  return turns.map((turn) => ({
    role: turn.role,
    personaId: turn.personaId ?? undefined,
    content: turn.content,
  }));
}

export async function createUserFanDiscussion({ userId, topic, personaIds, matchId = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0 || topic.length > 200) {
    throw new AppError(400, 'bad_request', '讨论主题无效');
  }

  const agent = createFanAgent();
  const { personas, context, aiResult } = await agent.createInitialDiscussion({
    userId,
    topic: topic.trim(),
    personaIds,
    matchId: matchId ?? null,
  });

  return runFanDiscussionTransaction(() => {
    const discussion = createFanDiscussion({
      userId,
      topic: topic.trim(),
      matchId: matchId ?? null,
    });
    linkDiscussionPersonas(discussion.id, personaIds);

    let sequence = 1;
    const persistedTurns = [];
    for (const turn of aiResult.turns) {
      persistedTurns.push(createFanDiscussionTurn({
        discussionId: discussion.id,
        sequence: sequence++,
        role: 'persona',
        personaId: turn.personaId,
        content: turn.content,
      }));
    }

    const feedItem = publishFanDiscussionFeedItem({
      discussionId: discussion.id,
      topic: topic.trim(),
      personaIds,
      turns: persistedTurns,
      matchId: matchId ?? null,
    });

    updateFanDiscussion(discussion.id, {
      turnCount: persistedTurns.length,
      feedItemId: feedItem?.id ?? null,
    });

    console.log(JSON.stringify({
      level: 'info',
      type: 'fan_discussion_created',
      discussionId: discussion.id,
      fanDiscussionTurnCount: persistedTurns.length,
      userId,
    }));

    return buildFanDiscussionDetail(discussion.id);
  });
}

export function getUserFanDiscussion({ discussionId, userId }) {
  const discussion = findFanDiscussionById(discussionId);
  if (!discussion) {
    throw new AppError(404, 'not_found', '讨论不存在');
  }
  assertDiscussionReadable(discussion, userId);
  return buildFanDiscussionDetail(discussionId);
}

export async function addUserFanDiscussionTurn({ discussionId, userId, content }) {
  if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 1000) {
    throw new AppError(400, 'bad_request', '发言内容无效');
  }

  const discussion = findFanDiscussionById(discussionId);
  if (!discussion) {
    throw new AppError(404, 'not_found', '讨论不存在');
  }
  assertDiscussionOwner(discussion, userId);

  const personaIds = listDiscussionPersonaIds(discussionId);
  const personas = findFanPersonasByIds(personaIds);
  const existingTurns = listFanDiscussionTurns(discussionId);
  const context = {
    topic: discussion.topic,
    matchSummary: null,
    feedSnippet: null,
  };

  const agent = createFanAgent();
  const aiResult = await agent.continueDiscussion({
    userId,
    topic: discussion.topic,
    personas,
    context,
    history: buildHistoryFromTurns(existingTurns),
    userContent: content.trim(),
  });

  return runFanDiscussionTransaction(() => {
    const userSequence = getNextTurnSequence(discussionId);
    const userTurn = createFanDiscussionTurn({
      discussionId,
      sequence: userSequence,
      role: 'user',
      userId,
      content: content.trim(),
    });

    let sequence = userSequence + 1;
    const personaTurns = [];
    for (const turn of aiResult.turns) {
      personaTurns.push(createFanDiscussionTurn({
        discussionId,
        sequence: sequence++,
        role: 'persona',
        personaId: turn.personaId,
        content: turn.content,
      }));
    }

    updateFanDiscussion(discussionId, {
      turnCount: userSequence + personaTurns.length,
    });

    return {
      userTurn: mapPublicTurn(userTurn),
      personaTurns: personaTurns.map(mapPublicTurn),
    };
  });
}

export function findFanDiscussionTurnForReport(turnId) {
  return findFanDiscussionTurnById(turnId);
}

export function findFanDiscussionForReport(discussionId) {
  return findFanDiscussionById(discussionId);
}
