import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { mergeSofaPlayerStatsForLeague } from '../../src/services/sofa-stats-import.js';
import { findPlayerStatsSnapshot } from '../../src/db/repositories/player-stats-snapshot-repository.js';

describe('sofa-stats-import', () => {
  beforeAll(() => {
    runMigrations();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('57', 'Arsenal FC', 'PL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at, sofascore_id
      ) VALUES
        ('tm-1', 'Bukayo Saka', '57', 'Right Winger', '2001-09-05', 'England', 'PL', ?, '111'),
        ('tm-2', 'Martin Odegaard', '57', 'Central Midfield', '1998-12-17', 'Norway', 'PL', ?, NULL)
    `).run(now, now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, synced_at
      ) VALUES ('s1', 'tm-1', 'PL', '2025', 10, 5, 0, 30, ?)
    `).run(now);
  });

  afterAll(() => {
    closeDb();
  });

  it('matches by sofascoreId and merges rating without overwriting goals', () => {
    const result = mergeSofaPlayerStatsForLeague({
      leagueCode: 'PL',
      season: '2025',
      sofaPlayerStats: [{
        sofascoreId: '111',
        name: 'Bukayo Saka',
        goals: 2,
        assists: 1,
        appearances: 28,
        rating: 7.6,
        season: '24/25',
      }],
      now: new Date().toISOString(),
    });

    expect(result.matched).toBe(1);
    const snapshot = findPlayerStatsSnapshot('tm-1', 'PL', '2025');
    expect(snapshot.goals).toBe(10);
    expect(snapshot.rating).toBe(7.6);
  });

  it('falls back to name matching when sofascoreId missing', () => {
    const result = mergeSofaPlayerStatsForLeague({
      leagueCode: 'PL',
      season: '2025',
      sofaPlayerStats: [{
        sofascoreId: '999',
        name: 'Martin Odegaard',
        goals: 5,
        assists: 8,
        rating: 7.9,
      }],
      now: new Date().toISOString(),
    });

    expect(result.matched).toBe(1);
    const snapshot = findPlayerStatsSnapshot('tm-2', 'PL', '2025');
    expect(snapshot.rating).toBe(7.9);
    const row = getDb().prepare('SELECT sofascore_id FROM players WHERE id = ?').get('tm-2');
    expect(row.sofascore_id).toBe('999');
  });
});
