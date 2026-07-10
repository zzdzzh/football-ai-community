import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { TacticalAgent, createTacticalAgent } from '../../src/agents/tactical-agent.js';
import { seedTacticalMatches } from '../helpers/seed-tactical-data.js';

describe('TacticalAgent', () => {
  const mockAi = { analyze: jest.fn() };
  let matchIds;

  beforeAll(() => {
    runMigrations();
    matchIds = seedTacticalMatches();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    mockAi.analyze.mockReset();
    mockAi.analyze.mockResolvedValue({
      summary: '压迫强度较高，转换迅速。',
      formation: '4-3-3',
      phases: [
        { key: 'pressing', label: '压迫', summary: '前场协同压迫', keyPlayerNames: ['Saka'] },
        { key: 'transition', label: '转换', summary: '快速反击', keyPlayerNames: [] },
      ],
      keyPlayers: [{ name: 'Saka', role: '边路核心' }],
      confidence: 'high',
      dataLimitations: [],
    });
  });

  it('returns tactical analysis for finished match', async () => {
    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'match',
      contextId: matchIds.matchId,
      userQuestion: '高位压迫如何组织？',
    });

    expect(result.content).toContain('【赛后复盘】');
    expect(result.tacticalAnalysis.analysisType).toBe('post_match');
    expect(result.tacticalAnalysis.formation).toBe('4-3-3');
    expect(result.tacticalAnalysis.phases.length).toBeGreaterThanOrEqual(1);
    expect(mockAi.analyze).toHaveBeenCalledWith(expect.objectContaining({
      analysisType: 'post_match',
    }));
  });

  it('labels scheduled match as pre-match prediction', async () => {
    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'match',
      contextId: matchIds.scheduledMatchId,
      userQuestion: '客队可能怎么踢？',
    });

    expect(result.content).toContain('【赛前战术预判】');
    expect(result.tacticalAnalysis.analysisType).toBe('pre_match_prediction');
  });

  it('caps confidence when data is limited', async () => {
    mockAi.analyze.mockResolvedValueOnce({
      summary: '数据有限。',
      formation: 'unknown',
      phases: [{ key: 'build_up', label: '出球', summary: '宏观描述' }],
      keyPlayers: [],
      confidence: 'high',
      dataLimitations: [],
    });

    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    const result = await agent.handleQuestion({
      contextType: 'match',
      contextId: matchIds.partialMatchId,
      userQuestion: '分析',
    });

    expect(result.confidence).toBe('medium');
    expect(result.tacticalAnalysis.dataLimitations.length).toBeGreaterThan(0);
  });

  it('throws 404 when match not found', async () => {
    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'match',
      contextId: 'missing',
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when team not found', async () => {
    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'team',
      contextId: 'missing',
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 for invalid context type', async () => {
    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'league',
      contextId: 'PL',
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 408 on AI timeout', async () => {
    const err = new Error('timeout');
    err.name = 'AbortError';
    mockAi.analyze.mockRejectedValueOnce(err);
    const agent = new TacticalAgent({ aiTacticalService: mockAi });
    await expect(agent.handleQuestion({
      contextType: 'match',
      contextId: matchIds.matchId,
      userQuestion: '?',
    })).rejects.toMatchObject({ statusCode: 408 });
  });

  it('createTacticalAgent returns agent instance', () => {
    expect(createTacticalAgent({ aiTacticalService: mockAi })).toBeInstanceOf(TacticalAgent);
  });
});
