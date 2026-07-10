import { getDb } from '../../src/db/connection.js';
import { seedTeamsAndMatches } from './seed-match-data.js';

export function seedTacticalMatches() {
  const base = seedTeamsAndMatches();
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO matches (
      id, league_code, season, matchday, utc_date, status,
      home_team_id, away_team_id, home_score, away_score,
      stats_json, events_json, data_completeness, last_synced_at, created_at, updated_at
    ) VALUES (
      '1002', 'PL', '2025', 11, '2026-07-15T15:00:00.000Z', 'SCHEDULED',
      '57', '61', NULL, NULL,
      NULL, NULL, 'pending', ?, ?, ?
    )
  `).run(now, now, now);

  db.prepare(`
    INSERT OR REPLACE INTO matches (
      id, league_code, season, matchday, utc_date, status,
      home_team_id, away_team_id, home_score, away_score,
      stats_json, events_json, data_completeness, last_synced_at, created_at, updated_at
    ) VALUES (
      '1003', 'PL', '2025', 9, '2026-06-20T15:00:00.000Z', 'FINISHED',
      '57', '61', 1, 1,
      ?, NULL, 'partial', ?, ?, ?
    )
  `).run(
    JSON.stringify([
      { name: 'Ball Possession', homeValue: 50, awayValue: 50, unit: '%' },
    ]),
    now,
    now,
    now,
  );

  return {
    ...base,
    scheduledMatchId: '1002',
    partialMatchId: '1003',
  };
}
