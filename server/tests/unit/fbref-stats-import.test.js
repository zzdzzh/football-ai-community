import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { mergeFbrefStatsForLeague } from '../../src/services/fbref-stats-import.js';
import { findPlayerStatsSnapshot } from '../../src/db/repositories/player-stats-snapshot-repository.js';
import { findPlayerById } from '../../src/db/repositories/player-repository.js';

describe('fbref-stats-import', () => {
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
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at
      ) VALUES ('p1', 'Bukayo Saka', '57', 'Right Winger', '2001-09-05', 'England', 'PL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, synced_at
      ) VALUES ('s1', 'p1', 'PL', '2025', 10, 5, 0, 30, ?)
    `).run(now);
  });

  afterAll(() => {
    closeDb();
  });

  it('merges fbref advanced stats without overwriting existing goals', () => {
    const now = new Date().toISOString();
    const result = mergeFbrefStatsForLeague({
      leagueCode: 'PL',
      season: '2025',
      fbrefStats: [{
        fbrefId: 'abc123',
        name: 'Bukayo Saka',
        goals: 8,
        assists: 4,
        minutes: 2800,
        appearances: 35,
        xg: 9.2,
        xa: 6.1,
        extraStats: { shots: 70, shotsOnTarget: 30 },
        leagueCode: 'PL',
        season: '2025',
      }],
      now,
    });

    expect(result).toEqual({ matched: 1, unmatched: 0 });

    const snapshot = findPlayerStatsSnapshot('p1', 'PL', '2025');
    expect(snapshot.goals).toBe(10);
    expect(snapshot.assists).toBe(5);
    expect(snapshot.minutes).toBe(2800);
    expect(snapshot.appearances).toBe(30);
    expect(snapshot.xg).toBe(9.2);
    expect(snapshot.xa).toBe(6.1);
    expect(snapshot.extraStats).toEqual({ shots: 70, shotsOnTarget: 30 });

    const player = findPlayerById('p1');
    expect(player).toBeTruthy();
    const row = getDb().prepare('SELECT fbref_id FROM players WHERE id = ?').get('p1');
    expect(row.fbref_id).toBe('abc123');
  });

  it('backfills missing date_of_birth from born year', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at
      ) VALUES ('p2', 'Gabriel Martinelli', '57', 'Left Winger', NULL, 'Brazil', 'PL', ?)
    `).run(now);

    const result = mergeFbrefStatsForLeague({
      leagueCode: 'PL',
      season: '2025',
      fbrefStats: [{
        name: 'Gabriel Martinelli',
        goals: 8,
        assists: 4,
        minutes: 2000,
        appearances: 28,
        born: 2001,
        leagueCode: 'PL',
        season: '2025',
      }],
      now,
    });

    expect(result).toEqual({ matched: 1, unmatched: 0 });
    const player = findPlayerById('p2');
    expect(player.dateOfBirth).toBe('2001-07-01');
    expect(player.age).toBeGreaterThan(20);
    const snapshot = findPlayerStatsSnapshot('p2', 'PL', '2025');
    expect(snapshot.appearances).toBe(28);
    expect(snapshot.minutes).toBe(2000);
  });

  it('counts unmatched fbref rows', () => {
    const result = mergeFbrefStatsForLeague({
      leagueCode: 'PL',
      season: '2025',
      fbrefStats: [{
        fbrefId: 'missing',
        name: 'Nobody Here',
        goals: 1,
        assists: 0,
        minutes: 100,
        xg: 0.5,
        xa: 0.1,
        leagueCode: 'PL',
        season: '2025',
      }],
      now: new Date().toISOString(),
    });
    expect(result).toEqual({ matched: 0, unmatched: 1 });
  });
});
