import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { StatsAgent, createStatsAgent } from '../../src/agents/stats-agent.js';

describe('StatsAgent', () => {
  beforeAll(() => {
    runMigrations();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('57', 'Arsenal FC', 'PL', ?), ('99', 'Unknown FC', 'PL', ?)
    `).run(now, now);
    db.prepare(`
      INSERT OR REPLACE INTO matches (
        id, league_code, utc_date, status, home_team_id, away_team_id,
        home_score, away_score, stats_json, events_json, data_completeness,
        last_synced_at, created_at, updated_at
      ) VALUES (
        '1001', 'PL', ?, 'FINISHED', '57', '99', 2, 0,
        ?, ?, 'complete', ?, ?, ?
      )
    `).run(
      now,
      JSON.stringify([
        { name: '控球率', homeValue: 60, awayValue: 40, unit: '%' },
        { name: '射门', homeValue: 12, awayValue: 5 },
        { name: '射正', homeValue: 5, awayValue: 2 },
      ]),
      JSON.stringify([{ minute: 30, type: 'GOAL', teamId: '57' }]),
      now,
      now,
      now,
    );
    db.prepare(`
      INSERT OR REPLACE INTO matches (
        id, league_code, utc_date, status, home_team_id, away_team_id,
        data_completeness, last_synced_at, created_at, updated_at
      ) VALUES ('1002', 'PL', ?, 'SCHEDULED', '57', '99', 'pending', ?, ?, ?)
    `).run(now, now, now, now);
  });

  afterAll(() => {
    closeDb();
  });

  const mockAi = {
    analyze: jest.fn(),
  };

  it('returns analysis for complete match context', async () => {
    mockAi.analyze.mockResolvedValueOnce({
      interpretation: '主队全面占优。',
      metrics: [
        { name: '控球率', value: 60, unit: '%' },
        { name: '射门', value: 12 },
        { name: '射正', value: 5 },
      ],
      confidence: 'high',
      missingFields: [],
    });

    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'match',
      contextId: '1001',
      userQuestion: '表现如何？',
    });

    expect(result.content).toContain('占优');
    expect(result.metrics.length).toBeGreaterThanOrEqual(3);
    expect(result.confidence).toBe('high');
  });

  it('downgrades confidence when missing fields exist', async () => {
    mockAi.analyze.mockResolvedValueOnce({
      interpretation: '部分数据可用。',
      metrics: [{ name: '射门', value: 1 }],
      confidence: 'high',
      missingFields: [],
    });

    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    const db = getDb();
    db.prepare(`
      UPDATE matches SET stats_json = NULL, events_json = NULL, data_completeness = 'partial',
      home_score = 1, away_score = 0 WHERE id = '1001'
    `).run();

    const result = await agent.handleQuestion({
      contextType: 'match',
      contextId: '1001',
      userQuestion: '数据？',
    });

    expect(result.confidence).toBe('medium');
    expect(result.missingFields.length).toBeGreaterThan(0);

    db.prepare(`
      UPDATE matches SET stats_json = ?, events_json = ?, data_completeness = 'complete'
      WHERE id = '1001'
    `).run(
      JSON.stringify([
        { name: '控球率', homeValue: 60, awayValue: 40, unit: '%' },
        { name: '射门', homeValue: 12, awayValue: 5 },
        { name: '射正', homeValue: 5, awayValue: 2 },
      ]),
      JSON.stringify([{ minute: 30, type: 'GOAL', teamId: '57' }]),
    );
  });

  it('throws 503 when data sync is pending', async () => {
    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'match',
      contextId: '1002',
      userQuestion: '预测？',
    })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('throws 404 when match not found', async () => {
    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'match',
      contextId: 'missing',
      userQuestion: '？',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 with team name suggestions when team not found', async () => {
    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'team',
      contextId: 'missing',
      userQuestion: 'Arsenal',
    })).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('Arsenal'),
    });
  });

  it('throws 404 without suggestions when query matches nothing', async () => {
    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'team',
      contextId: 'missing',
      userQuestion: 'zzzznotfound999',
    })).rejects.toMatchObject({ statusCode: 404, message: '上下文资源不存在' });
  });

  it('createStatsAgent with defaults uses factory', () => {
    expect(createStatsAgent({ aiAnalysisService: mockAi })).toBeInstanceOf(StatsAgent);
  });

  it('handles general context', async () => {
    mockAi.analyze.mockResolvedValueOnce({
      interpretation: '通用回答。',
      metrics: [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 },
        { name: 'c', value: 3 },
      ],
      confidence: 'medium',
      missingFields: [],
    });

    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'general',
      contextId: null,
      userQuestion: '英超趋势？',
    });
    expect(result.content).toBeDefined();
  });

  it('throws 400 for invalid context type', async () => {
    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'invalid',
      contextId: null,
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('handles team context successfully', async () => {
    mockAi.analyze.mockResolvedValueOnce({
      interpretation: '阿森纳数据。',
      metrics: [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 },
        { name: 'c', value: 3 },
      ],
      confidence: 'medium',
      missingFields: [],
    });

    const agent = new StatsAgent({ aiAnalysisService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'team',
      contextId: '57',
      userQuestion: '本赛季？',
    });
    expect(result.content).toContain('阿森纳');
  });
});
