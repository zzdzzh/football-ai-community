import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import {
  buildScoutContext,
  parseMaxAgeFromQuestion,
  parsePositionFromQuestion,
  CANDIDATE_CAP,
} from '../../src/services/scout-context-builder.js';
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
    expect(parseMaxAgeFromQuestion('推荐球员')).toBeNull();
  });

  it('parses position keyword from question', () => {
    expect(parsePositionFromQuestion('擅长压迫的中场')).toBe('中场');
    expect(parsePositionFromQuestion('前锋推荐')).toBe('前锋');
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

  it('returns syncMessage when player sync is down', () => {
    const db = getDb();
    db.prepare("UPDATE player_sync_meta SET status = 'down'").run();
    const context = buildScoutContext({
      contextType: 'league',
      contextId: 'PL',
    });
    expect(context.syncMessage).toBeDefined();
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
