import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { AppError } from '../../src/middleware/error.js';
import { resetAiRateLimitStore } from '../../src/services/ai-rate-limit.js';
import {
  RelationshipNarrativeAgent,
  createRelationshipNarrativeAgent,
} from '../../src/agents/relationship-narrative-agent.js';
import {
  generateRelationshipNarrative,
} from '../../src/services/relationship-narrative-service.js';

const PLAYER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAYER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ANALYSIS_ID = 'analysis-ready-001';
const COMPUTED_AT = '2026-07-17T10:00:00.000Z';

function readyAnalysis(overrides = {}) {
  return {
    id: ANALYSIS_ID,
    status: 'ready',
    playerIdLow: PLAYER_A,
    playerIdHigh: PLAYER_B,
    computedAt: COMPUTED_AT,
    result: {
      clubmates: { status: 'established' },
      nationalTeammates: { status: 'not_established' },
      clubmateDetails: [{
        clubId: 'club-1',
        clubName: 'FC Barcelona',
        overlapFrom: '2014-07-11',
        overlapTo: '2020-09-23',
        precision: 'exact',
      }],
      nationalTeammateDetails: [],
      transfer: { directTransferLink: false, successiveSameClub: false, evidence: [] },
      indirectPath: null,
      pathStatus: 'no_path',
      relationDistance: 0,
      selfPair: false,
    },
    dataFreshness: { clubStints: 'fresh' },
    playerA: { id: PLAYER_A, name: 'Lionel Messi' },
    playerB: { id: PLAYER_B, name: 'Luis Suárez' },
    ...overrides,
  };
}

function validAiPayload() {
  return {
    narrative: '两人曾在 FC Barcelona 有重叠效力时段，国家队层面未发现同队证据。',
    claims: [{
      type: 'clubmate',
      status: 'established',
      clubName: 'FC Barcelona',
      overlapFrom: '2014-07-11',
      overlapTo: '2020-09-23',
    }],
  };
}

describe('RelationshipNarrativeAgent', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    resetAiRateLimitStore();
    const db = getDb();
    db.prepare('DELETE FROM relationship_narratives').run();
  });

  it('generates and persists narrative on Mock AI success', async () => {
    const mockAi = {
      generateNarrative: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify(validAiPayload()),
        model: 'mock-model',
      }),
    };
    const agent = new RelationshipNarrativeAgent({ aiRelationshipService: mockAi });
    const out = await agent.generate({
      analysis: readyAnalysis(),
      userId: 'user-1',
    });

    expect(mockAi.generateNarrative).toHaveBeenCalledTimes(1);
    expect(out.status).toBe('ready');
    expect(out.narrativeText).toMatch(/FC Barcelona/);
    expect(out.model).toBe('mock-model');
    expect(out.reused).toBe(false);
  });

  it('throws 409 when analysis is not ready (ready-gate)', async () => {
    const mockAi = { generateNarrative: jest.fn() };
    const agent = new RelationshipNarrativeAgent({ aiRelationshipService: mockAi });

    await expect(agent.generate({
      analysis: readyAnalysis({ status: 'computing' }),
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 409, error: 'analysis_not_ready' });

    expect(mockAi.generateNarrative).not.toHaveBeenCalled();
  });

  it('throws 408 on AI timeout', async () => {
    const err = new Error('timeout');
    err.name = 'AbortError';
    const mockAi = {
      generateNarrative: jest.fn().mockRejectedValueOnce(err),
    };
    const agent = new RelationshipNarrativeAgent({ aiRelationshipService: mockAi });

    await expect(agent.generate({
      analysis: readyAnalysis(),
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 408 });
  });

  it('throws 503 on upstream AI failure', async () => {
    const mockAi = {
      generateNarrative: jest.fn().mockRejectedValueOnce(new Error('upstream down')),
    };
    const agent = new RelationshipNarrativeAgent({ aiRelationshipService: mockAi });

    await expect(agent.generate({
      analysis: readyAnalysis(),
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('throws 422 when verification fails and does not persist ready narrative', async () => {
    const mockAi = {
      generateNarrative: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify({
          narrative: '两人一起夺得欧冠冠军。',
          claims: [{ type: 'honor', status: 'established', note: 'UCL' }],
        }),
        model: 'mock-model',
      }),
    };
    const agent = new RelationshipNarrativeAgent({ aiRelationshipService: mockAi });

    await expect(agent.generate({
      analysis: readyAnalysis(),
      userId: 'user-1',
    })).rejects.toMatchObject({
      statusCode: 422,
      error: 'narrative_verification_failed',
    });

    const row = getDb().prepare(`
      SELECT * FROM relationship_narratives
      WHERE analysis_id = ? AND analysis_computed_at = ? AND status = 'ready'
    `).get(ANALYSIS_ID, COMPUTED_AT);
    expect(row).toBeUndefined();
  });

  it('rethrows AppError from AI layer', async () => {
    const mockAi = {
      generateNarrative: jest.fn().mockRejectedValueOnce(
        new AppError(503, 'service_unavailable', 'AI down'),
      ),
    };
    const agent = createRelationshipNarrativeAgent({ aiRelationshipService: mockAi });

    await expect(agent.generate({
      analysis: readyAnalysis(),
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 503, error: 'service_unavailable' });
  });
});

describe('relationship narrative rate-limit (agentId=relationship)', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    resetAiRateLimitStore();
  });

  it('throws 429 via assertAiRateLimit({ agentId: relationship }) on real generate', async () => {
    const mockAi = {
      generateNarrative: jest.fn().mockResolvedValue({
        text: JSON.stringify(validAiPayload()),
        model: 'mock-model',
      }),
    };

    // 通过 service 入口触发限流（仅真实生成计次）
    await expect(generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'rate-user',
      force: true,
      analysisOverride: readyAnalysis(),
      agentOverride: new RelationshipNarrativeAgent({ aiRelationshipService: mockAi }),
      rateLimit: { maxPerWindow: 1, windowMs: 60000 },
    })).resolves.toMatchObject({ status: 'ready' });

    await expect(generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'rate-user',
      force: true,
      analysisOverride: readyAnalysis(),
      agentOverride: new RelationshipNarrativeAgent({ aiRelationshipService: mockAi }),
      rateLimit: { maxPerWindow: 1, windowMs: 60000 },
    })).rejects.toMatchObject({ statusCode: 429, error: 'rate_limited' });
  });
});
