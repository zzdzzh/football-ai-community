import { mapSnapshotToPlayerStats } from '../../src/db/repositories/player-stats-snapshot-repository.js';

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
    ]);
  });

  it('omits optional metrics when absent', () => {
    const stats = mapSnapshotToPlayerStats({
      goals: 2,
      assists: 1,
      penalties: 0,
    });
    expect(stats).toEqual([
      { name: '进球', value: 2 },
      { name: '助攻', value: 1 },
      { name: '点球', value: 0 },
    ]);
  });
});
