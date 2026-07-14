import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import {
  buildScoutContext,
  parseAgeRangeFromQuestion,
  parseMaxAgeFromQuestion,
  parseMinAgeFromQuestion,
  parsePositionFromQuestion,
  CANDIDATE_CAP,
} from '../../src/services/scout-context-builder.js';
import { parseStatFocusFromQuestion } from '../../src/services/scout-key-stats.js';
import { seedScoutPlayers } from '../helpers/seed-scout-data.js';

describe('ScoutContextBuilder', () => {
  beforeAll(() => {
    runMigrations();
    seedScoutPlayers();
  });

  afterAll(() => {
    closeDb();
  });

  it('parses max age from alternate patterns', () => {
    expect(parseMaxAgeFromQuestion('under 23 midfielders')).toBe(23);
    expect(parseMaxAgeFromQuestion('年龄≤22')).toBe(22);
  });

  it('returns null position when question has no keyword', () => {
    expect(parsePositionFromQuestion('随便问问')).toBeNull();
  });

  it('parses max age from Chinese question', () => {
    expect(parseMaxAgeFromQuestion('需要25岁以下的中场')).toBe(25);
    expect(parseMaxAgeFromQuestion('27岁以内的边后卫')).toBe(27);
    expect(parseMaxAgeFromQuestion('推荐球员')).toBeNull();
  });

  it('parses min age from Chinese question', () => {
    expect(parseMinAgeFromQuestion('需要一个30岁以上门将')).toBe(30);
    expect(parseMinAgeFromQuestion('over 28 goalkeepers')).toBe(28);
    expect(parseMinAgeFromQuestion('至少35岁')).toBe(35);
  });

  it('parses age range from Chinese question', () => {
    expect(parseAgeRangeFromQuestion('20-27岁以内的进攻性边后卫')).toEqual({
      minAge: 20,
      maxAge: 27,
    });
    expect(parseAgeRangeFromQuestion('22到25岁中场')).toEqual({
      minAge: 22,
      maxAge: 25,
    });
    expect(parseAgeRangeFromQuestion('25岁以下')).toBeNull();
  });

  it('parses position keyword from question', () => {
    expect(parsePositionFromQuestion('擅长压迫的中场')).toBe('中场');
    expect(parsePositionFromQuestion('前锋推荐')).toBe('前锋');
    expect(parsePositionFromQuestion('进攻性边后卫')).toBe('边后卫');
  });

  it('attaches statFocus from user question into filters', () => {
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '需要一名擅长压迫的中场',
    });
    expect(context.filters.statFocus.focuses).toContain('defense');
    expect(context.filters.statFocus.preferredStatNames).toEqual(
      expect.arrayContaining(['拦截', '抢断成功']),
    );
    expect(parseStatFocusFromQuestion('找一个进球能力强的前锋').focuses).toContain('attack');
    expect(parseStatFocusFromQuestion('西甲最佳射手是谁').focuses).toContain('attack');
  });

  it('ranks league candidates by goals for top-scorer questions and includes stats-only membership', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('cl-star-team', 'CL Star Team', 'CL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES
        ('pd-top-scorer', 'Alpha Top Scorer', 'cl-star-team', 'Forward', '1998-12-20', 'CL', ?),
        ('pd-prev-scorer', 'Legacy High Scorer', 'cl-star-team', 'Forward', '1995-01-01', 'CL', ?)
    `).run(now, now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, minutes, synced_at
      ) VALUES
        ('snap-pd-top', 'pd-top-scorer', 'PD', '25-26', 25, 5, 2, 30, 2600, ?),
        ('snap-cl-side', 'pd-top-scorer', 'CL', '25-26', 10, 1, 0, 8, 700, ?),
        ('snap-pd-prev', 'pd-prev-scorer', 'PD', '2024', 19, 2, 0, 30, 1970, ?),
        ('snap-pd-prev-cur', 'pd-prev-scorer', 'PD', '25-26', 5, 1, 0, 20, 1200, ?)
    `).run(now, now, now, now);

    // 姓名排序会把 Bulk/阿字母选手顶在前面；按进球排序必须把「仅 PD 有统计」的球星放进候选池
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PD',
      userQuestion: '西甲最佳射手是谁',
    });
    expect(context.filters.statFocus.focuses).toContain('attack');
    expect(context.candidates.some((c) => c.id === 'pd-top-scorer')).toBe(true);
    expect(context.candidates[0]?.id).toBe('pd-top-scorer');
    const top = context.candidates.find((c) => c.id === 'pd-top-scorer');
    expect(top.stats.some((s) => s.name === '进球' && s.value === 25)).toBe(true);
    expect(top.statsSeason).toBe('25-26');
    expect(top.statsSeasonLabel).toBe('25/26 赛季');

    // 上赛季 19 球不得压过当前赛季；有当季数据时展示当季 5 球
    const legacy = context.candidates.find((c) => c.id === 'pd-prev-scorer');
    expect(legacy).toBeDefined();
    expect(legacy.statsSeason).toBe('25-26');
    expect(legacy.stats.some((s) => s.name === '进球' && s.value === 5)).toBe(true);
    expect(context.candidates.findIndex((c) => c.id === 'pd-prev-scorer'))
      .toBeGreaterThan(context.candidates.findIndex((c) => c.id === 'pd-top-scorer'));

    // 仅有历史赛季的高进球者，排在所有当前赛季有球者之后
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES ('pd-hist-only', 'Hist Only Scorer', 'cl-star-team', 'Forward', '1993-01-01', 'CL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, minutes, synced_at
      ) VALUES ('snap-hist-only', 'pd-hist-only', 'PD', '2024', 30, 1, 0, 28, 2000, ?)
    `).run(now);
    const reranked = buildScoutContext({
      contextType: 'league',
      contextId: 'PD',
      userQuestion: '西甲最佳射手是谁',
    });
    const histIdx = reranked.candidates.findIndex((c) => c.id === 'pd-hist-only');
    const curIdx = reranked.candidates.findIndex((c) => c.id === 'pd-top-scorer');
    expect(histIdx).toBeGreaterThan(curIdx);
    expect(reranked.candidates.find((c) => c.id === 'pd-hist-only')?.statsSeasonLabel).toBe('2024 赛季');
  });

  it('filters candidates by league context', () => {
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐中场',
    });
    expect(context.candidates.length).toBeGreaterThan(0);
    expect(context.candidates.every((c) => c.leagueCode === 'PL')).toBe(true);
    expect(context.candidates.some((c) => c.id === 'p5')).toBe(false);
  });

  it('filters candidates by team context', () => {
    const context = buildScoutContext({
      contextType: 'team',
      contextId: '57',
      userQuestion: '推荐球员',
    });
    expect(context.candidates.every((c) => c.teamId === '57')).toBe(true);
  });

  it('returns notFound for invalid league', () => {
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'XX',
    });
    expect(context.notFound).toBe(true);
  });

  it('returns notFound for missing team', () => {
    const context = buildScoutContext({
      contextType: 'team',
      contextId: 'missing-team',
    });
    expect(context.notFound).toBe(true);
  });

  it('returns invalid for unsupported context type', () => {
    const context = buildScoutContext({
      contextType: 'match',
      contextId: '1001',
    });
    expect(context.invalid).toBe(true);
  });

  it('applies age filter from question', () => {
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '25岁以下的中场',
    });
    expect(context.candidates.every((c) => c.age == null || c.age <= 25)).toBe(true);
  });

  it('matches full-back style positions for 后卫/边后卫 filters', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES
        ('lb-young', 'Young Left Back', '57', 'Left-Back', '2003-01-01', 'PL', ?),
        ('cb-old', 'Old Centre Back', '57', 'Centre-Back', '1990-01-01', 'PL', ?)
    `).run(now, now);

    const defenders = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '后卫',
    });
    expect(defenders.candidates.some((c) => c.id === 'lb-young')).toBe(true);
    expect(defenders.candidates.some((c) => c.id === 'cb-old')).toBe(true);

    const fullbacks = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '20-27岁以内的进攻性边后卫',
    });
    expect(fullbacks.filters).toMatchObject({
      minAge: 20,
      maxAge: 27,
      position: '边后卫',
    });
    expect(fullbacks.candidates.some((c) => c.id === 'lb-young')).toBe(true);
    expect(fullbacks.candidates.some((c) => c.id === 'cb-old')).toBe(false);
  });

  it('applies min age filter from question', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES ('gk-old', 'Old Keeper', '57', 'Goalkeeper', '1988-01-01', 'PL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES ('gk-young', 'Young Keeper', '57', 'Goalkeeper', '2005-01-01', 'PL', ?)
    `).run(now);
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '30岁以上的门将',
    });
    expect(context.filters.minAge).toBe(30);
    expect(context.candidates.some((c) => c.id === 'gk-old')).toBe(true);
    expect(context.candidates.some((c) => c.id === 'gk-young')).toBe(false);
  });

  it('caps candidates at CANDIDATE_CAP', () => {
    const db = getDb();
    const now = new Date().toISOString();
    for (let i = 0; i < 60; i += 1) {
      db.prepare(`
        INSERT OR REPLACE INTO players (
          id, name, team_id, position, league_code, updated_at
        ) VALUES (?, ?, '57', 'Midfield', 'PL', ?)
      `).run(`bulk-${i}`, `Bulk Player ${i}`, now);
    }
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
    });
    expect(context.candidates.length).toBeLessThanOrEqual(CANDIDATE_CAP);
  });

  it('handles general context', () => {
    const context = buildScoutContext({
      contextType: 'general',
      userQuestion: '推荐球员',
    });
    expect(context.candidates.length).toBeGreaterThan(0);
    expect(context.contextType).toBe('general');
  });

  it('matches English position keywords directly', () => {
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: 'Winger recommendation',
    });
    expect(context.candidates.some((c) => c.position?.includes('Winger'))).toBe(true);
  });

  it('excludes players without position when filtering by keyword', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO players (id, name, team_id, position, league_code, updated_at)
      VALUES ('no-pos', 'No Position Player', '57', NULL, 'PL', ?)
    `).run(now);
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '中场',
    });
    expect(context.candidates.some((c) => c.id === 'no-pos')).toBe(false);
  });

  it('includes players without stats snapshots', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('99', 'Test FC', 'PL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (id, name, team_id, position, league_code, updated_at)
      VALUES ('no-stats', 'No Stats Player', '99', 'Central Midfield', 'PL', ?)
    `).run(now);
    const context = buildScoutContext({
      contextType: 'team',
      contextId: '99',
      userQuestion: '推荐球员',
    });
    const candidate = context.candidates.find((c) => c.id === 'no-stats');
    expect(candidate?.stats).toEqual([]);
  });

  it('falls back to richer club snapshots when league-scoped stats are empty', () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('wc-team', 'Brazil', 'WC', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES ('wc-gk-rich', 'WC Keeper', 'wc-team', 'Goalkeeper', '1992-01-01', 'WC', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, minutes, synced_at
      ) VALUES ('snap-club', 'wc-gk-rich', 'PL', '25-26', 0, 0, 0, 30, 2700, ?)
    `).run(now);

    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'WC',
      userQuestion: '30岁以上门将',
    });
    const candidate = context.candidates.find((c) => c.id === 'wc-gk-rich');
    expect(candidate).toBeDefined();
    expect(candidate.stats.some((s) => s.name === '出场分钟' && s.value === 2700)).toBe(true);
  });

  it('still returns candidates when sync is down but league data exists', () => {
    const db = getDb();
    db.prepare("UPDATE player_sync_meta SET status = 'down'").run();
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
    });
    expect(context.syncMessage).toBeUndefined();
    expect(context.candidates.length).toBeGreaterThan(0);
    db.prepare("UPDATE player_sync_meta SET status = 'ok'").run();
  });

  it('returns syncMessage when player sync is down and catalog is empty', () => {
    const db = getDb();
    db.prepare('DELETE FROM player_stats_snapshots').run();
    db.prepare('DELETE FROM players').run();
    db.prepare("UPDATE player_sync_meta SET status = 'down', last_sync_at = NULL, players_count = 0").run();
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
    });
    expect(context.syncMessage).toBeDefined();
    seedScoutPlayers();
    db.prepare("UPDATE player_sync_meta SET status = 'ok'").run();
  });

  it('returns syncMessage when league player data was never synced', () => {
    const db = getDb();
    db.prepare('DELETE FROM players WHERE league_code = ?').run('FL1');
    db.prepare(`
      UPDATE player_sync_meta
      SET last_sync_at = NULL, players_count = 0, status = 'ok', last_error = NULL
      WHERE league_code = 'FL1'
    `).run();
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'FL1',
    });
    expect(context.syncMessage).toContain('尚未同步');
    seedScoutPlayers();
  });
});
