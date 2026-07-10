import { getDb } from '../../src/db/connection.js';

export function seedTeamsAndMatches() {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO teams (id, name, short_name, tla, crest_url, league_code, updated_at)
    VALUES ('57', 'Arsenal FC', 'Arsenal', 'ARS', 'https://example.com/ars.png', 'PL', ?),
           ('61', 'Chelsea FC', 'Chelsea', 'CHE', 'https://example.com/che.png', 'PL', ?)
  `).run(now, now);

  db.prepare(`
    INSERT OR REPLACE INTO matches (
      id, league_code, season, matchday, utc_date, status,
      home_team_id, away_team_id, home_score, away_score,
      stats_json, events_json, data_completeness, last_synced_at, created_at, updated_at
    ) VALUES (
      '1001', 'PL', '2025', 10, '2026-07-01T15:00:00.000Z', 'FINISHED',
      '57', '61', 2, 1,
      ?, ?, 'complete', ?, ?, ?
    )
  `).run(
    JSON.stringify([
      { name: 'Ball Possession', homeValue: 58, awayValue: 42, unit: '%' },
      { name: 'Shots', homeValue: 14, awayValue: 9 },
      { name: 'Shots on Goal', homeValue: 6, awayValue: 3 },
    ]),
    JSON.stringify([
      { minute: 23, type: 'GOAL', teamId: '57', playerName: 'Saka' },
      { minute: 67, type: 'GOAL', teamId: '61', playerName: 'Palmer' },
    ]),
    now,
    now,
    now,
  );

  return {
    homeTeamId: '57',
    awayTeamId: '61',
    matchId: '1001',
  };
}

export async function registerAndLogin(app, request) {
  const user = {
    email: `stats-test-${Date.now()}@example.com`,
    password: 'password123',
    nickname: 'Stats测试',
  };
  const registerRes = await request(app).post('/api/auth/register').send(user);
  return {
    token: registerRes.body.token,
    user: registerRes.body.user,
  };
}
