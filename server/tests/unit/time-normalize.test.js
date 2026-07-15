import {
  normalizeTimeBound,
  normalizeStintInterval,
  intervalsOverlap,
} from '../../src/services/time-normalize.js';

const AS_OF = '2026-07-15';

describe('normalizeTimeBound', () => {
  it('解析精确日期 YYYY-MM-DD', () => {
    const r = normalizeTimeBound('2019-06-24', { asOf: AS_OF });
    expect(r).toEqual({
      joinedOn: '2019-06-24',
      leftOn: '2019-06-24',
      precision: 'exact',
    });
  });

  it('解析月份 YYYY-MM', () => {
    const r = normalizeTimeBound('2020-02', { asOf: AS_OF });
    expect(r.joinedOn).toBe('2020-02-01');
    expect(r.leftOn).toBe('2020-02-29');
    expect(r.precision).toBe('month');
  });

  it('解析年份 YYYY', () => {
    const r = normalizeTimeBound('2018', { asOf: AS_OF });
    expect(r).toEqual({
      joinedOn: '2018-01-01',
      leftOn: '2018-12-31',
      precision: 'year',
    });
  });

  it('解析赛季 2019/20', () => {
    const r = normalizeTimeBound('2019/20', { asOf: AS_OF });
    expect(r).toEqual({
      joinedOn: '2019-07-01',
      leftOn: '2020-06-30',
      precision: 'season',
    });
  });

  it('解析赛季 2019-2020', () => {
    const r = normalizeTimeBound('2019-2020', { asOf: AS_OF });
    expect(r).toEqual({
      joinedOn: '2019-07-01',
      leftOn: '2020-06-30',
      precision: 'season',
    });
  });

  it('赛季跨年需 century 修正（1999/00）', () => {
    const r = normalizeTimeBound('1999/00', { asOf: AS_OF });
    expect(r.joinedOn).toBe('1999-07-01');
    expect(r.leftOn).toBe('2000-06-30');
    expect(r.precision).toBe('season');
  });

  it('joined 角色空值 → unparseable', () => {
    expect(normalizeTimeBound(null, { role: 'joined', asOf: AS_OF })).toEqual({
      joinedOn: null,
      leftOn: null,
      precision: 'unparseable',
    });
    expect(normalizeTimeBound('  ', { role: 'joined', asOf: AS_OF })).toEqual({
      joinedOn: null,
      leftOn: null,
      precision: 'unparseable',
    });
  });

  it('left 角色空值 → open_ended 使用 asOf', () => {
    const r = normalizeTimeBound(null, { role: 'left', asOf: AS_OF });
    expect(r).toEqual({
      joinedOn: null,
      leftOn: AS_OF,
      precision: 'open_ended',
      displayLeft: '至今',
    });
  });

  it.each([
    ['至今'],
    ['present'],
    ['PRESENT'],
    ['heute'],
    ['aktuell'],
    ['current'],
    ['--'],
  ])('open_ended 文本 "%s"', (text) => {
    const r = normalizeTimeBound(text, { role: 'joined', asOf: AS_OF });
    expect(r.precision).toBe('open_ended');
    expect(r.leftOn).toBe(AS_OF);
    expect(r.displayLeft).toBe('至今');
  });

  it('无法解析的文本 → unparseable', () => {
    expect(normalizeTimeBound('Jul 1, 2004', { asOf: AS_OF })).toEqual({
      joinedOn: null,
      leftOn: null,
      precision: 'unparseable',
    });
  });

  it('未传 asOf 时使用当天日期', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = normalizeTimeBound('至今', { role: 'joined' });
    expect(r.leftOn).toBe(today);
  });

  it('默认 role=joined 与默认 opts', () => {
    const r = normalizeTimeBound('2024-05-10');
    expect(r.precision).toBe('exact');
  });
});

describe('normalizeStintInterval', () => {
  it('join 无法解析 → 整段 unparseable', () => {
    expect(normalizeStintInterval({
      joinedRaw: '???',
      leftRaw: '2020-01-01',
      asOf: AS_OF,
    })).toEqual({
      joinedOn: null,
      leftOn: null,
      precision: 'unparseable',
    });
  });

  it.each([null, '', '至今', 'present'])('leave open-ended（leftRaw=%s）', (leftRaw) => {
    const r = normalizeStintInterval({
      joinedRaw: '2019-01-01',
      leftRaw,
      asOf: AS_OF,
    });
    expect(r).toEqual({
      joinedOn: '2019-01-01',
      leftOn: AS_OF,
      precision: 'open_ended',
      displayLeft: '至今',
    });
  });

  it('leave 无法解析 → unparseable', () => {
    expect(normalizeStintInterval({
      joinedRaw: '2019-01-01',
      leftRaw: 'not-a-date',
      asOf: AS_OF,
    })).toEqual({
      joinedOn: null,
      leftOn: null,
      precision: 'unparseable',
    });
  });

  it('取较低精度（exact + year → year）', () => {
    const r = normalizeStintInterval({
      joinedRaw: '2019-06-01',
      leftRaw: '2020',
      asOf: AS_OF,
    });
    expect(r.joinedOn).toBe('2019-06-01');
    expect(r.leftOn).toBe('2020-12-31');
    expect(r.precision).toBe('year');
  });

  it('取较低精度（month 优于 exact）', () => {
    const r = normalizeStintInterval({
      joinedRaw: '2019-06',
      leftRaw: '2020-03-15',
      asOf: AS_OF,
    });
    expect(r.precision).toBe('month');
  });

  it('取较低精度（season 优于 year）', () => {
    const r = normalizeStintInterval({
      joinedRaw: '2018',
      leftRaw: '2019/20',
      asOf: AS_OF,
    });
    expect(r.precision).toBe('season');
  });

  it('取较低精度（season 优于 year，joined 侧更粗）', () => {
    const r = normalizeStintInterval({
      joinedRaw: '2019/20',
      leftRaw: '2021',
      asOf: AS_OF,
    });
    expect(r.precision).toBe('season');
  });

  it('默认 opts 对象', () => {
    expect(normalizeStintInterval()).toEqual({
      joinedOn: null,
      leftOn: null,
      precision: 'unparseable',
    });
  });
});

describe('intervalsOverlap', () => {
  const interval = (joinedOn, leftOn, precision = 'exact') => ({
    joinedOn,
    leftOn,
    precision,
  });

  it('重叠区间返回 true', () => {
    expect(intervalsOverlap(
      interval('2019-01-01', '2020-12-31'),
      interval('2020-06-01', '2021-06-30'),
    )).toBe(true);
  });

  it('不重叠区间返回 false', () => {
    expect(intervalsOverlap(
      interval('2018-01-01', '2018-12-31'),
      interval('2020-01-01', '2020-12-31'),
    )).toBe(false);
  });

  it('相邻边界相接算重叠', () => {
    expect(intervalsOverlap(
      interval('2019-01-01', '2020-01-01'),
      interval('2020-01-01', '2021-01-01'),
    )).toBe(true);
  });

  it('null 参数返回 false', () => {
    expect(intervalsOverlap(null, interval('2019-01-01', '2020-01-01'))).toBe(false);
    expect(intervalsOverlap(interval('2019-01-01', '2020-01-01'), null)).toBe(false);
  });

  it('unparseable 精度不参与重叠', () => {
    expect(intervalsOverlap(
      interval('2019-01-01', '2020-01-01', 'unparseable'),
      interval('2019-06-01', '2021-01-01'),
    )).toBe(false);
    expect(intervalsOverlap(
      interval('2019-01-01', '2020-01-01'),
      interval('2019-06-01', '2021-01-01', 'unparseable'),
    )).toBe(false);
  });

  it('缺失边界返回 false', () => {
    expect(intervalsOverlap(
      { joinedOn: null, leftOn: '2020-01-01', precision: 'exact' },
      interval('2019-01-01', '2020-01-01'),
    )).toBe(false);
    expect(intervalsOverlap(
      interval('2019-01-01', '2020-01-01'),
      { joinedOn: '2019-01-01', leftOn: null, precision: 'exact' },
    )).toBe(false);
  });
});
