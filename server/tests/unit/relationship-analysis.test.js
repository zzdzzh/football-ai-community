import { analyzeDirectRelations } from '../../src/services/relationship-analysis-service.js';

const CLUB_BARCA = { clubId: 'club-barca', clubName: 'FC Barcelona' };
const CLUB_REAL = { clubId: 'club-real', clubName: 'Real Madrid' };

function stint({ clubId, clubName, joinedOn, leftOn, timePrecision }) {
  return { clubId, clubName, joinedOn, leftOn, timePrecision };
}

function nationalStint({ nationKey, nationName, joinedOn, leftOn, timePrecision }) {
  return { nationKey, nationName, joinedOn, leftOn, timePrecision };
}

function player({ id, clubStints = [], nationalTeamStints = [] }) {
  return { id, clubStints, nationalTeamStints };
}

describe('analyzeDirectRelations', () => {
  it('同俱乐部且时间重叠 → clubmates established', () => {
    const result = analyzeDirectRelations({
      playerA: player({
        id: 'a',
        clubStints: [
          stint({ ...CLUB_BARCA, joinedOn: '2010-07-01', leftOn: '2015-06-30', timePrecision: 'exact' }),
        ],
      }),
      playerB: player({
        id: 'b',
        clubStints: [
          stint({ ...CLUB_BARCA, joinedOn: '2012-01-01', leftOn: '2018-06-30', timePrecision: 'exact' }),
        ],
      }),
    });

    expect(result.clubmates.status).toBe('established');
    expect(result.clubmateDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        clubId: CLUB_BARCA.clubId,
        clubName: CLUB_BARCA.clubName,
        overlapFrom: expect.any(String),
        overlapTo: expect.any(String),
        precision: expect.any(String),
      }),
    ]));
    expect(result.clubmateDetails.length).toBeGreaterThan(0);
  });

  it('同俱乐部但时间不重叠 → clubmates not_established', () => {
    const result = analyzeDirectRelations({
      playerA: player({
        id: 'a',
        clubStints: [
          stint({ ...CLUB_BARCA, joinedOn: '2008-01-01', leftOn: '2010-06-30', timePrecision: 'exact' }),
        ],
      }),
      playerB: player({
        id: 'b',
        clubStints: [
          stint({ ...CLUB_BARCA, joinedOn: '2015-07-01', leftOn: '2018-06-30', timePrecision: 'exact' }),
        ],
      }),
    });

    expect(result.clubmates.status).toBe('not_established');
    expect(result.clubmateDetails).toEqual([]);
  });

  it('双方均无俱乐部效力段 → clubmates unknown', () => {
    const result = analyzeDirectRelations({
      playerA: player({ id: 'a', clubStints: [] }),
      playerB: player({ id: 'b', clubStints: [] }),
    });

    expect(result.clubmates.status).toBe('unknown');
    expect(result.clubmateDetails).toEqual([]);
  });

  it('仅一方有俱乐部效力段 → clubmates unknown', () => {
    const result = analyzeDirectRelations({
      playerA: player({
        id: 'a',
        clubStints: [
          stint({ ...CLUB_REAL, joinedOn: '2019-01-01', leftOn: '2020-12-31', timePrecision: 'exact' }),
        ],
      }),
      playerB: player({ id: 'b', clubStints: [] }),
    });

    expect(result.clubmates.status).toBe('unknown');
    expect(result.clubmateDetails).toEqual([]);
  });

  it('同 nationKey 且时间重叠 → nationalTeammates established', () => {
    const result = analyzeDirectRelations({
      playerA: player({
        id: 'a',
        nationalTeamStints: [
          nationalStint({
            nationKey: 'argentina',
            nationName: 'Argentina',
            joinedOn: '2005-01-01',
            leftOn: '2016-12-31',
            timePrecision: 'year',
          }),
        ],
      }),
      playerB: player({
        id: 'b',
        nationalTeamStints: [
          nationalStint({
            nationKey: 'argentina',
            nationName: 'Argentina',
            joinedOn: '2010-01-01',
            leftOn: '2022-12-31',
            timePrecision: 'year',
          }),
        ],
      }),
    });

    expect(result.nationalTeammates.status).toBe('established');
    expect(result.nationalTeammateDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityId: 'argentina',
        entityName: 'Argentina',
        overlapFrom: expect.any(String),
        overlapTo: expect.any(String),
        precision: expect.any(String),
      }),
    ]));
  });

  it('双方均无国家队效力段 → nationalTeammates unknown', () => {
    const result = analyzeDirectRelations({
      playerA: player({ id: 'a', nationalTeamStints: [] }),
      playerB: player({ id: 'b', nationalTeamStints: [] }),
    });

    expect(result.nationalTeammates.status).toBe('unknown');
    expect(result.nationalTeammateDetails).toEqual([]);
  });

  it('不同 nationKey → nationalTeammates not_established', () => {
    const result = analyzeDirectRelations({
      playerA: player({
        id: 'a',
        nationalTeamStints: [
          nationalStint({
            nationKey: 'argentina',
            nationName: 'Argentina',
            joinedOn: '2010-01-01',
            leftOn: '2020-12-31',
            timePrecision: 'year',
          }),
        ],
      }),
      playerB: player({
        id: 'b',
        nationalTeamStints: [
          nationalStint({
            nationKey: 'uruguay',
            nationName: 'Uruguay',
            joinedOn: '2010-01-01',
            leftOn: '2020-12-31',
            timePrecision: 'year',
          }),
        ],
      }),
    });

    expect(result.nationalTeammates.status).toBe('not_established');
    expect(result.nationalTeammateDetails).toEqual([]);
  });

  it('unparseable 精度段不计入 established', () => {
    const result = analyzeDirectRelations({
      playerA: player({
        id: 'a',
        clubStints: [
          stint({
            ...CLUB_BARCA,
            joinedOn: '2010-01-01',
            leftOn: '2015-12-31',
            timePrecision: 'unparseable',
          }),
        ],
        nationalTeamStints: [
          nationalStint({
            nationKey: 'argentina',
            nationName: 'Argentina',
            joinedOn: '2005-01-01',
            leftOn: '2016-12-31',
            timePrecision: 'unparseable',
          }),
        ],
      }),
      playerB: player({
        id: 'b',
        clubStints: [
          stint({
            ...CLUB_BARCA,
            joinedOn: '2012-01-01',
            leftOn: '2018-06-30',
            timePrecision: 'exact',
          }),
        ],
        nationalTeamStints: [
          nationalStint({
            nationKey: 'argentina',
            nationName: 'Argentina',
            joinedOn: '2010-01-01',
            leftOn: '2022-12-31',
            timePrecision: 'year',
          }),
        ],
      }),
    });

    // 不可解析段不参与成立判定；无法可靠判定交集 → unknown（非 not_established）
    expect(result.clubmates.status).toBe('unknown');
    expect(result.clubmateDetails).toEqual([]);
    expect(result.nationalTeammates.status).toBe('unknown');
    expect(result.nationalTeammateDetails).toEqual([]);
  });
});
