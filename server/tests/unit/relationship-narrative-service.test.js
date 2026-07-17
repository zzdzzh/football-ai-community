import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { resetAiRateLimitStore } from '../../src/services/ai-rate-limit.js';
import { upsertReadyNarrative } from '../../src/db/repositories/relationship-narrative-repository.js';
import {
  generateRelationshipNarrative,
  getRelationshipNarrative,
} from '../../src/services/relationship-narrative-service.js';
import { RelationshipNarrativeAgent } from '../../src/agents/relationship-narrative-agent.js';

const PLAYER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAYER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ANALYSIS_ID = 'analysis-version-001';
const COMPUTED_AT = '2026-07-17T10:00:00.000Z';
const COMPUTED_AT_NEW = '2026-07-17T11:00:00.000Z';

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
    dataFreshness: {},
    playerA: { id: PLAYER_A, name: 'Lionel Messi' },
    playerB: { id: PLAYER_B, name: 'Luis Suárez' },
    ...overrides,
  };
}

function validAiPayload(text = '两人曾在 FC Barcelona 有重叠效力时段。') {
  return {
    narrative: text,
    claims: [{
      type: 'clubmate',
      status: 'established',
      clubName: 'FC Barcelona',
      overlapFrom: '2014-07-11',
      overlapTo: '2020-09-23',
    }],
  };
}

describe('relationship-narrative-service version reuse', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    resetAiRateLimitStore();
    getDb().prepare('DELETE FROM relationship_narratives').run();
  });

  it('reuses same (analysis_id, computed_at) without calling AI', async () => {
    upsertReadyNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      analysisId: ANALYSIS_ID,
      analysisComputedAt: COMPUTED_AT,
      narrativeText: '已缓存的叙事正文',
      model: 'cached-model',
      claims: [],
    });

    const mockAi = { generateNarrative: jest.fn() };
    const out = await generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'u1',
      force: false,
      analysisOverride: readyAnalysis(),
      agentOverride: new RelationshipNarrativeAgent({ aiRelationshipService: mockAi }),
      rateLimit: { maxPerWindow: 1, windowMs: 60000 },
    });

    expect(out.reused).toBe(true);
    expect(out.narrativeText).toBe('已缓存的叙事正文');
    expect(mockAi.generateNarrative).not.toHaveBeenCalled();
  });

  it('skips rate-limit on cache hit', async () => {
    upsertReadyNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      analysisId: ANALYSIS_ID,
      analysisComputedAt: COMPUTED_AT,
      narrativeText: '缓存命中',
      model: 'm',
      claims: [],
    });

    const mockAi = { generateNarrative: jest.fn() };
    const agent = new RelationshipNarrativeAgent({ aiRelationshipService: mockAi });

    // maxPerWindow=1：若命中仍计限流，第二次会 429
    await generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'rate-u',
      analysisOverride: readyAnalysis(),
      agentOverride: agent,
      rateLimit: { maxPerWindow: 1, windowMs: 60000 },
    });

    await expect(generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'rate-u',
      analysisOverride: readyAnalysis(),
      agentOverride: agent,
      rateLimit: { maxPerWindow: 1, windowMs: 60000 },
    })).resolves.toMatchObject({ reused: true });
  });

  it('force=true regenerates and overwrites same version', async () => {
    upsertReadyNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      analysisId: ANALYSIS_ID,
      analysisComputedAt: COMPUTED_AT,
      narrativeText: '旧叙事',
      model: 'old',
      claims: [],
    });

    const mockAi = {
      generateNarrative: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify(validAiPayload('强制重生成的新叙事')),
        model: 'new-model',
      }),
    };

    const out = await generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'u1',
      force: true,
      analysisOverride: readyAnalysis(),
      agentOverride: new RelationshipNarrativeAgent({ aiRelationshipService: mockAi }),
    });

    expect(out.reused).toBe(false);
    expect(out.narrativeText).toBe('强制重生成的新叙事');
    expect(mockAi.generateNarrative).toHaveBeenCalledTimes(1);
  });

  it('treats narrative as stale when analysis computed_at changes', async () => {
    upsertReadyNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      analysisId: ANALYSIS_ID,
      analysisComputedAt: COMPUTED_AT,
      narrativeText: '旧版本叙事',
      model: 'm',
      claims: [],
    });

    // get 使用真实 DB 分析行；此处用 analysisOverride 走 generate 的版本键
    const mockAi = {
      generateNarrative: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify(validAiPayload('新版本叙事')),
        model: 'm2',
      }),
    };

    const out = await generateRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'u1',
      force: false,
      analysisOverride: readyAnalysis({ computedAt: COMPUTED_AT_NEW }),
      agentOverride: new RelationshipNarrativeAgent({ aiRelationshipService: mockAi }),
    });

    expect(out.reused).toBe(false);
    expect(out.analysisComputedAt).toBe(COMPUTED_AT_NEW);
    expect(out.narrativeText).toBe('新版本叙事');
    expect(mockAi.generateNarrative).toHaveBeenCalled();
  });

  it('getRelationshipNarrative returns 404 stale when only older version exists', async () => {
    // 直接测仓储+服务：写入旧版本后，用带新 computedAt 的 analysis 解析
    // getRelationshipNarrative 走 DB 分析；这里通过注入：先测 find 语义用 generate 的 stale 路径
    // 为可测 stale，扩展 get 接受 analysisOverride（T018）
    upsertReadyNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      analysisId: ANALYSIS_ID,
      analysisComputedAt: COMPUTED_AT,
      narrativeText: '过期叙事',
      model: 'm',
      claims: [],
    });

    await expect(getRelationshipNarrative({
      playerIdA: PLAYER_A,
      playerIdB: PLAYER_B,
      userId: 'u1',
      analysisOverride: readyAnalysis({ computedAt: COMPUTED_AT_NEW }),
    })).rejects.toMatchObject({
      statusCode: 404,
      error: 'narrative_stale',
    });
  });
});
