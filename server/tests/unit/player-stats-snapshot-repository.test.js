import {
  mapSnapshotToPlayerStats,
  pickBestPlayerStatsSnapshot,
  scoreSnapshotRichness,
} from '../../src/db/repositories/player-stats-snapshot-repository.js';

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
});
