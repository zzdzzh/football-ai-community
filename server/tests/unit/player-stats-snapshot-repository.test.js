import {
  mapSnapshotToPlayerStats,
  pickBestPlayerStatsSnapshot,
  scoreSnapshotRichness,
  isUntrustedThinSnapshot,
  deleteUntrustedThinSnapshots,
} from '../../src/db/repositories/player-stats-snapshot-repository.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';

describe('player-stats-snapshot mapSnapshotToPlayerStats', () => {
  it('includes fbref metrics when present', () => {
    const stats = mapSnapshotToPlayerStats({
      goals: 10,
      assists: 5,
      penalties: 1,
      appearances: 30,
      minutes: 2700,
      xg: 8.5,
      xa: 4.2,
      rating: 7.4,
      extraStats: {
        starts: 28,
        shots: 90,
        shotsOnTarget: 40,
        interceptions: 12,
      },
    });

    expect(stats).toEqual([
      { name: '进球', value: 10 },
      { name: '助攻', value: 5 },
      { name: '点球', value: 1 },
      { name: '出场', value: 30 },
      { name: '出场分钟', value: 2700 },
      { name: 'xG', value: 8.5 },
      { name: 'xA', value: 4.2 },
      { name: '评分', value: 7.4 },
      { name: '首发', value: 28 },
      { name: '射门', value: 90 },
      { name: '射正', value: 40 },
      { name: '拦截', value: 12 },
    ]);
  });

  it('omits zero penalties and optional metrics when absent', () => {
    const stats = mapSnapshotToPlayerStats({
      goals: 2,
      assists: 1,
      penalties: 0,
    });
    expect(stats).toEqual([
      { name: '进球', value: 2 },
      { name: '助攻', value: 1 },
    ]);
  });

  it('picks richest snapshot over newer thin season row', () => {
    const best = pickBestPlayerStatsSnapshot([
      { season: '2026', goals: 25, assists: 0, appearances: 9 },
      { season: '2024', goals: 22, assists: 11, appearances: 33, minutes: 3191 },
      { season: '25-26', goals: 27, assists: 8, appearances: 35, rating: 7.3 },
    ]);
    expect(best.season).toBe('25-26');
    expect(scoreSnapshotRichness(best)).toBeGreaterThan(scoreSnapshotRichness({
      season: '2026', goals: 25, assists: 0, appearances: 9,
    }));
  });

  it('falls back to FBref minutes row when current season is thin', () => {
    const best = pickBestPlayerStatsSnapshot([
      { season: '2026', goals: 25, assists: 0, appearances: 9 },
      { season: '2024', goals: 22, assists: 11, appearances: 33, minutes: 3191 },
    ]);
    expect(best.season).toBe('2024');
    expect(best.minutes).toBe(3191);
  });

  it('rejects Transfermarkt-style career dump thin snapshots', () => {
    expect(isUntrustedThinSnapshot({
      season: '2026', goals: 30, assists: 0, appearances: 24,
    })).toBe(true);

    const best = pickBestPlayerStatsSnapshot([
      { season: '2026', goals: 30, assists: 0, appearances: 24 },
      { season: '2025', goals: 2, assists: 1, appearances: 28, minutes: 1800 },
    ]);
    expect(best.season).toBe('2025');
    expect(best.goals).toBe(2);
  });

  it('returns null when only untrusted thin snapshots exist', () => {
    const best = pickBestPlayerStatsSnapshot([
      { season: '2026', goals: 30, assists: 0, appearances: 24 },
      { season: '2026', goals: 25, assists: 0, appearances: 23 },
    ]);
    expect(best).toBeNull();
  });
});

describe('deleteUntrustedThinSnapshots', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  it('deletes poisoned high-goal rows without minutes', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('t-poison', 'Poison FC', 'PD', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at
      ) VALUES ('tm-poison', 'Poison Player', 't-poison', 'Right Winger', NULL, 'Spain', 'PD', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, minutes, synced_at
      ) VALUES ('s-poison', 'tm-poison', 'PD', '2026', 30, 0, 0, 24, NULL, ?)
    `).run(now);

    const deleted = deleteUntrustedThinSnapshots();
    expect(deleted).toBeGreaterThanOrEqual(1);
    const row = db.prepare(
      'SELECT id FROM player_stats_snapshots WHERE id = ?',
    ).get('s-poison');
    expect(row).toBeUndefined();
  });
});
