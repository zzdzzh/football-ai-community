import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

const DEFAULT_ENABLED_AGENTS = ['news', 'stats', 'scout', 'tactical', 'fan', 'content'];

function parseJsonArray(value, fallback = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function mapPreferenceRow(row) {
  return {
    followedTeams: parseJsonArray(row.followed_teams),
    followedLeagues: parseJsonArray(row.followed_leagues),
    enabledAgents: parseJsonArray(row.enabled_agents, DEFAULT_ENABLED_AGENTS),
    notifyMatchReport: row.notify_match_report === 1,
  };
}

export function getDefaultPreferences() {
  return {
    followedTeams: [],
    followedLeagues: [],
    enabledAgents: [...DEFAULT_ENABLED_AGENTS],
    notifyMatchReport: true,
  };
}

export function findPreferenceByUserId(userId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
  return row ? mapPreferenceRow(row) : null;
}

export function getOrCreatePreferenceByUserId(userId) {
  const existing = findPreferenceByUserId(userId);
  if (existing) return existing;

  const db = getDb();
  const now = new Date().toISOString();
  const defaults = getDefaultPreferences();

  db.prepare(`
    INSERT INTO user_preferences (
      id, user_id, followed_teams, followed_leagues, enabled_agents,
      notify_match_report, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    userId,
    JSON.stringify(defaults.followedTeams),
    JSON.stringify(defaults.followedLeagues),
    JSON.stringify(defaults.enabledAgents),
    defaults.notifyMatchReport ? 1 : 0,
    now,
  );

  return defaults;
}

export function upsertPreference(userId, preference) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(userId);

  if (existing) {
    db.prepare(`
      UPDATE user_preferences
      SET followed_teams = ?, followed_leagues = ?, enabled_agents = ?,
          notify_match_report = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      JSON.stringify(preference.followedTeams),
      JSON.stringify(preference.followedLeagues),
      JSON.stringify(preference.enabledAgents),
      preference.notifyMatchReport ? 1 : 0,
      now,
      userId,
    );
  } else {
    db.prepare(`
      INSERT INTO user_preferences (
        id, user_id, followed_teams, followed_leagues, enabled_agents,
        notify_match_report, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId,
      JSON.stringify(preference.followedTeams),
      JSON.stringify(preference.followedLeagues),
      JSON.stringify(preference.enabledAgents),
      preference.notifyMatchReport ? 1 : 0,
      now,
    );
  }

  return findPreferenceByUserId(userId);
}
