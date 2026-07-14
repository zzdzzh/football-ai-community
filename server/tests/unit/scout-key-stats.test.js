import {
  parseStatFocusFromQuestion,
  composeKeyStats,
} from '../../src/services/scout-key-stats.js';

describe('scout-key-stats', () => {
  it('infers defense focus from pressing keywords', () => {
    const focus = parseStatFocusFromQuestion('需要一名擅长压迫的中场', '中场');
    expect(focus.focuses).toContain('defense');
    expect(focus.preferredStatNames).toEqual(
      expect.arrayContaining(['拦截', '抢断成功']),
    );
  });

  it('infers attack focus for finishing requests', () => {
    const focus = parseStatFocusFromQuestion('找一个射门终结能力强的前锋');
    expect(focus.focuses).toContain('attack');
    expect(focus.preferredStatNames).toEqual(
      expect.arrayContaining(['射门', '射正', 'xG']),
    );
  });

  it('falls back to position default when no keyword', () => {
    const focus = parseStatFocusFromQuestion('推荐一名球员', '门将');
    expect(focus.focuses).toContain('goalkeeping');
    expect(focus.preferredStatNames).toContain('扑救');
  });

  it('always keeps base stats and appends preferred focus stats', () => {
    const composed = composeKeyStats(
      [{ name: '射门', value: 90 }, { name: '点球', value: 0 }],
      [
        { name: '进球', value: 10 },
        { name: '助攻', value: 5 },
        { name: '出场分钟', value: 2700 },
        { name: '射门', value: 90 },
        { name: '射正', value: 40 },
        { name: '评分', value: 7.2 },
      ],
      ['射门', '射正', 'xG', '评分'],
    );

    expect(composed.map((s) => s.name)).toEqual([
      '进球',
      '助攻',
      '出场分钟',
      '射门',
      '射正',
      '评分',
    ]);
  });
});
