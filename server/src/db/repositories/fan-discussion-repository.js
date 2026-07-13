import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export function mapFanDiscussionRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    topic: row.topic,
    matchId: row.match_id ?? null,
    status: row.status,
    turnCount: row.turn_count,
    feedItemId: row.feed_item_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFanDiscussionTurnRow(row) {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    sequence: row.sequence,
    role: row.role,
    personaId: row.persona_id ?? null,
    personaDisplayName: row.persona_display_name ?? null,
    teamName: row.team_name ?? null,
    userId: row.user_id ?? null,
    content: row.content,
    isHidden: row.is_hidden === 1,
    createdAt: row.created_at,
  };
}

export function createFanDiscussion(discussion) {
  const db = getDb();
  const id = discussion.id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO fan_discussions (
      id, user_id, topic, match_id, status, turn_count, feed_item_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    discussion.userId,
    discussion.topic,
    discussion.matchId ?? null,
    discussion.status ?? 'active',
    discussion.turnCount ?? 0,
    discussion.feedItemId ?? null,
    discussion.createdAt ?? now,
    discussion.updatedAt ?? now,
  );
  return findFanDiscussionById(id);
}

export function findFanDiscussionById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM fan_discussions WHERE id = ?').get(id);
  return row ? mapFanDiscussionRow(row) : null;
}

export function updateFanDiscussion(id, patch) {
  const db = getDb();
  const fields = [];
  const params = [];

  if (patch.status !== undefined) {
    fields.push('status = ?');
    params.push(patch.status);
  }
  if (patch.turnCount !== undefined) {
    fields.push('turn_count = ?');
    params.push(patch.turnCount);
  }
  if (patch.feedItemId !== undefined) {
    fields.push('feed_item_id = ?');
    params.push(patch.feedItemId);
  }
  if (fields.length === 0) {
    return findFanDiscussionById(id);
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.prepare(`UPDATE fan_discussions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return findFanDiscussionById(id);
}

export function linkDiscussionPersonas(discussionId, personaIds) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fan_discussion_personas (discussion_id, persona_id)
    VALUES (?, ?)
  `);
  for (const personaId of personaIds) {
    stmt.run(discussionId, personaId);
  }
}

export function listDiscussionPersonaIds(discussionId) {
  const db = getDb();
  return db.prepare(`
    SELECT persona_id FROM fan_discussion_personas WHERE discussion_id = ?
  `).all(discussionId).map((row) => row.persona_id);
}

export function createFanDiscussionTurn(turn) {
  const db = getDb();
  const id = turn.id ?? randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO fan_discussion_turns (
      id, discussion_id, sequence, role, persona_id, user_id, content, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    turn.discussionId,
    turn.sequence,
    turn.role,
    turn.personaId ?? null,
    turn.userId ?? null,
    turn.content,
    turn.isHidden ? 1 : 0,
    turn.createdAt ?? now,
  );
  return findFanDiscussionTurnById(id);
}

export function findFanDiscussionTurnById(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT ft.*, fp.display_name AS persona_display_name, t.name AS team_name
    FROM fan_discussion_turns ft
    LEFT JOIN fan_personas fp ON fp.id = ft.persona_id
    LEFT JOIN teams t ON t.id = fp.team_id
    WHERE ft.id = ?
  `).get(id);
  return row ? mapFanDiscussionTurnRow(row) : null;
}

export function listFanDiscussionTurns(discussionId, { includeHidden = false } = {}) {
  const db = getDb();
  const hiddenClause = includeHidden ? '' : 'AND ft.is_hidden = 0';
  const rows = db.prepare(`
    SELECT ft.*, fp.display_name AS persona_display_name, t.name AS team_name
    FROM fan_discussion_turns ft
    LEFT JOIN fan_personas fp ON fp.id = ft.persona_id
    LEFT JOIN teams t ON t.id = fp.team_id
    WHERE ft.discussion_id = ? ${hiddenClause}
    ORDER BY ft.sequence ASC
  `).all(discussionId);
  return rows.map(mapFanDiscussionTurnRow);
}

export function hideFanDiscussionTurn(turnId) {
  const db = getDb();
  db.prepare('UPDATE fan_discussion_turns SET is_hidden = 1 WHERE id = ?').run(turnId);
  return findFanDiscussionTurnById(turnId);
}

export function getNextTurnSequence(discussionId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(MAX(sequence), 0) + 1 AS nextSeq
    FROM fan_discussion_turns
    WHERE discussion_id = ?
  `).get(discussionId);
  return row.nextSeq;
}

export function runFanDiscussionTransaction(handler) {
  const db = getDb();
  return db.transaction(handler)();
}
