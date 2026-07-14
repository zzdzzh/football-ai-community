import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { ScoutAgent, createScoutAgent } from '../../src/agents/scout-agent.js';
import { seedScoutPlayers } from '../helpers/seed-scout-data.js';

describe('ScoutAgent', () => {
  const mockAi = { recommend: jest.fn() };

  beforeAll(() => {
    runMigrations();
    seedScoutPlayers();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    mockAi.recommend.mockReset();
  });

  it('returns recommendations for league context', async () => {
    mockAi.recommend.mockResolvedValueOnce({
      summary: '推荐如下。',
      recommendations: [
        { playerId: 'p2', matchReason: 'a', keyStats: [{ name: '进球', value: 5 }, { name: '助攻', value: 8 }, { name: '出场', value: 28 }] },
        { playerId: 'p3', matchReason: 'b', keyStats: [{ name: '进球', value: 3 }, { name: '助攻', value: 4 }, { name: '出场', value: 32 }] },
        { playerId: 'p4', matchReason: 'c', keyStats: [{ name: '进球', value: 12 }, { name: '助攻', value: 6 }, { name: '点球', value: 2 }] },
      ],
      narrowHint: null,
      confidence: 'high',
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐中场',
    });

    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendations[0].playerName).toBe('Martin Ødegaard');
    expect(result.recommendations[0].keyStats.map((s) => s.name)).toEqual(
      expect.arrayContaining(['进球', '助攻']),
    );
    expect(result.confidence).toBe('high');
    expect(mockAi.recommend).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({
        statFocus: expect.objectContaining({
          focuses: expect.any(Array),
        }),
      }),
    }));
  });

  it('throws 404 when league not found', async () => {
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'league',
      contextId: 'XX',
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when team not found', async () => {
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'team',
      contextId: 'missing',
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 for invalid context type', async () => {
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'match',
      contextId: '1001',
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 503 when no candidates available', async () => {
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '1岁以下的球员',
    })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('still recommends when sync is down but league data exists', async () => {
    mockAi.recommend.mockResolvedValueOnce({
      summary: '推荐如下。',
      recommendations: [
        { playerId: 'p2', matchReason: 'a', keyStats: [{ name: '进球', value: 5 }] },
        { playerId: 'p3', matchReason: 'b', keyStats: [{ name: '进球', value: 3 }] },
        { playerId: 'p4', matchReason: 'c', keyStats: [{ name: '进球', value: 12 }] },
      ],
      narrowHint: null,
      confidence: 'medium',
    });
    const db = getDb();
    db.prepare("UPDATE player_sync_meta SET status = 'down'").run();
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    });
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    db.prepare("UPDATE player_sync_meta SET status = 'ok'").run();
  });

  it('throws 408 on AI timeout', async () => {
    const err = new Error('timeout');
    err.name = 'AbortError';
    mockAi.recommend.mockRejectedValueOnce(err);
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    })).rejects.toMatchObject({ statusCode: 408 });
  });

  it('rethrows non-timeout AI errors', async () => {
    mockAi.recommend.mockRejectedValueOnce(new Error('AI service failed'));
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    })).rejects.toThrow('AI service failed');
  });

  it('handles timeout via err.code TIMEOUT', async () => {
    const err = new Error('timed out');
    err.code = 'TIMEOUT';
    mockAi.recommend.mockRejectedValueOnce(err);
    const agent = new ScoutAgent({ aiScoutService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    })).rejects.toMatchObject({ statusCode: 408 });
  });

  it('preserves AI narrowHint when pool is not too broad', async () => {
    mockAi.recommend.mockResolvedValueOnce({
      summary: '推荐。',
      recommendations: [
        { playerId: 'p2', matchReason: 'a', keyStats: [{ name: '进球', value: 5 }, { name: '助攻', value: 8 }, { name: '出场', value: 28 }] },
        { playerId: 'p3', matchReason: 'b', keyStats: [{ name: '进球', value: 3 }, { name: '助攻', value: 4 }, { name: '出场', value: 32 }] },
        { playerId: 'p4', matchReason: 'c', keyStats: [{ name: '进球', value: 12 }, { name: '助攻', value: 6 }, { name: '点球', value: 2 }] },
      ],
      narrowHint: '可补充联赛范围',
      confidence: 'medium',
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐中场',
    });
    expect(result.narrowHint).toBe('可补充联赛范围');
  });

  it('enriches unknown playerId with fallback name', async () => {
    mockAi.recommend.mockResolvedValueOnce({
      summary: '推荐。',
      recommendations: [
        { playerId: 'unknown-id', matchReason: 'x', keyStats: [{ name: 'a', value: 1 }, { name: 'b', value: 2 }, { name: 'c', value: 3 }] },
        { playerId: 'p2', matchReason: 'y', keyStats: [{ name: '进球', value: 5 }, { name: '助攻', value: 8 }, { name: '出场', value: 28 }] },
        { playerId: 'p3', matchReason: 'z', keyStats: [{ name: '进球', value: 3 }, { name: '助攻', value: 4 }, { name: '出场', value: 32 }] },
      ],
      narrowHint: null,
      confidence: 'low',
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    });
    expect(result.recommendations[0].playerName).toBe('unknown-id');
  });

  it('defaults confidence to medium when AI omits it', async () => {
    mockAi.recommend.mockResolvedValueOnce({
      summary: '推荐。',
      recommendations: [
        { playerId: 'p2', matchReason: 'a', keyStats: [{ name: '进球', value: 5 }, { name: '助攻', value: 8 }, { name: '出场', value: 28 }] },
        { playerId: 'p3', matchReason: 'b', keyStats: [{ name: '进球', value: 3 }, { name: '助攻', value: 4 }, { name: '出场', value: 32 }] },
        { playerId: 'p4', matchReason: 'c', keyStats: [{ name: '进球', value: 12 }, { name: '助攻', value: 6 }, { name: '点球', value: 2 }] },
      ],
      narrowHint: null,
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    });
    expect(result.confidence).toBe('medium');
  });

  it('fills base keyStats when AI returns invalid keyStats', async () => {
    mockAi.recommend.mockResolvedValueOnce({
      summary: '推荐。',
      recommendations: [
        { playerId: 'p2', matchReason: '', keyStats: 'invalid' },
        { playerId: 'p3', matchReason: 'b', keyStats: [{ name: '进球', value: 3 }, { name: '助攻', value: 4 }, { name: '出场', value: 32 }] },
        { playerId: 'p4', matchReason: 'c', keyStats: [{ name: '进球', value: 12 }, { name: '助攻', value: 6 }, { name: '点球', value: 2 }] },
      ],
      narrowHint: null,
      confidence: 'low',
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐',
    });
    expect(result.recommendations[0].keyStats.map((s) => s.name)).toEqual(
      expect.arrayContaining(['进球', '助攻', '出场']),
    );
  });

  it('createScoutAgent without overrides uses default factory', () => {
    expect(createScoutAgent()).toBeInstanceOf(ScoutAgent);
  });

  it('returns narrowHint and caps to top 5 when pool is too broad', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    for (let i = 0; i < 6; i += 1) {
      db.prepare(`
        INSERT OR REPLACE INTO players (
          id, name, team_id, position, date_of_birth, league_code, updated_at
        ) VALUES (?, ?, '57', 'Central Midfield', '2000-01-01', 'PL', ?)
      `).run(`wide-${i}`, `Wide Player ${i}`, now);
    }

    mockAi.recommend.mockResolvedValueOnce({
      summary: '候选人较多。',
      recommendations: Array.from({ length: 6 }, (_, i) => ({
        playerId: `p${(i % 4) + 2}`,
        matchReason: `reason ${i}`,
        keyStats: [
          { name: '进球', value: i },
          { name: '助攻', value: i },
          { name: '出场', value: i },
        ],
      })),
      narrowHint: null,
      confidence: 'medium',
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '推荐球员',
    });

    expect(result.recommendations.length).toBeLessThanOrEqual(5);
    expect(result.narrowHint).toBeTruthy();
  });

  it('createScoutAgent with defaults', () => {
    expect(createScoutAgent({ aiScoutService: mockAi })).toBeInstanceOf(ScoutAgent);
  });

  it('passes statsSeason and appends note when historical season mixes with current', async () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, league_code, updated_at
      ) VALUES
        ('cur-scorer', 'Current Scorer', '57', 'Forward', '2001-01-01', 'PL', ?),
        ('old-scorer', 'Old Season Scorer', '57', 'Forward', '1995-01-01', 'PL', ?)
    `).run(now, now);
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, minutes, synced_at
      ) VALUES
        ('snap-cur', 'cur-scorer', 'PL', '25-26', 12, 3, 0, 20, 1600, ?),
        ('snap-old', 'old-scorer', 'PL', '2024', 19, 2, 0, 30, 1970, ?)
    `).run(now, now);

    mockAi.recommend.mockResolvedValueOnce({
      summary: '对比如下。',
      recommendations: [
        { playerId: 'cur-scorer', matchReason: '当季进球领先', keyStats: [{ name: '进球', value: 12 }, { name: '助攻', value: 3 }, { name: '出场', value: 20 }] },
        { playerId: 'old-scorer', matchReason: '进球很多', keyStats: [{ name: '进球', value: 19 }, { name: '助攻', value: 2 }, { name: '出场', value: 30 }] },
        { playerId: 'p4', matchReason: '备选', keyStats: [{ name: '进球', value: 12 }, { name: '助攻', value: 6 }, { name: '出场', value: 30 }] },
      ],
      narrowHint: null,
      confidence: 'high',
    });

    const agent = new ScoutAgent({ aiScoutService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '英超最佳射手是谁',
    });

    const current = result.recommendations.find((r) => r.playerId === 'cur-scorer');
    const old = result.recommendations.find((r) => r.playerId === 'old-scorer');
    expect(current?.statsSeasonLabel).toBe('25/26 赛季');
    expect(old?.statsSeasonLabel).toBe('2024 赛季');
    expect(old?.matchReason).toContain('2024 赛季');
    expect(old?.matchReason).toContain('非当前赛季');
    expect(current?.matchReason).not.toContain('非当前赛季');
  });
});
