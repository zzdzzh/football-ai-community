import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { AppError } from '../../src/middleware/error.js';
import { FanAgent } from '../../src/agents/fan-agent.js';
import { seedFanPersonas } from '../helpers/seed-fan-data.js';

describe('FanAgent', () => {
  const mockAi = { simulateTurns: jest.fn() };
  const mockModeration = { check: jest.fn().mockReturnValue({ allowed: true }) };

  beforeAll(() => {
    runMigrations();
    seedFanPersonas();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    mockAi.simulateTurns.mockReset();
    mockModeration.check.mockReset();
    mockModeration.check.mockReturnValue({ allowed: true });
  });

  function createAgent(overrides = {}) {
    return new FanAgent({
      aiFanService: mockAi,
      moderationService: mockModeration,
      ...overrides,
    });
  }

  const initialTurns = () => ([
    { personaId: 'persona-arsenal', content: '阿森纳这场真稳' },
    { personaId: 'persona-liverpool', content: '利物浦也不差' },
    { personaId: 'persona-arsenal', content: '萨卡表现亮眼' },
    { personaId: 'persona-liverpool', content: '萨拉赫还有机会' },
  ]);

  it('creates initial discussion with at least 4 persona turns', async () => {
    mockAi.simulateTurns.mockResolvedValueOnce({
      turns: initialTurns(),
      disclaimer: '模拟内容仅供娱乐，不代表真实球迷或俱乐部立场',
    });

    const agent = createAgent();
    const result = await agent.createInitialDiscussion({
      userId: 'u1',
      topic: '阿森纳 vs 利物浦',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    });

    expect(result.aiResult.turns).toHaveLength(4);
    expect(result.personas).toHaveLength(2);
  });

  it('throws 400 when fewer than 2 personas selected', async () => {
    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal'],
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when persona ids are duplicated', async () => {
    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-arsenal'],
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when persona is invalid', async () => {
    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'missing-persona'],
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when matchId does not exist', async () => {
    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
      matchId: 'missing-match',
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 422 when AI output violates moderation', async () => {
    mockAi.simulateTurns.mockResolvedValueOnce({
      turns: [{ personaId: 'persona-arsenal', content: '官方宣布转会' }],
    });
    mockModeration.check.mockImplementation((text) => (
      text.includes('官方宣布')
        ? { allowed: false, reason: 'false_official_claim' }
        : { allowed: true }
    ));

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toMatchObject({ statusCode: 422, error: 'content_policy_violation' });
  });

  it('throws 408 when AI times out on initial generation', async () => {
    const err = new Error('timeout');
    err.name = 'AbortError';
    mockAi.simulateTurns.mockRejectedValueOnce(err);

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toMatchObject({ statusCode: 408 });
  });

  it('throws 503 when AI returns fewer than 4 turns', async () => {
    mockAi.simulateTurns.mockResolvedValueOnce({
      turns: initialTurns().slice(0, 2),
    });

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('continues discussion after valid user input', async () => {
    mockAi.simulateTurns.mockResolvedValueOnce({
      turns: [{ personaId: 'persona-liverpool', content: '我同意你的观点' }],
    });

    const agent = createAgent();
    const result = await agent.continueDiscussion({
      userId: 'u1',
      topic: 'test',
      personas: [{ id: 'persona-arsenal' }, { id: 'persona-liverpool' }],
      context: { topic: 'test' },
      history: [{ role: 'persona', personaId: 'persona-arsenal', content: '开场' }],
      userContent: '我觉得阿森纳更强',
    });

    expect(result.turns).toHaveLength(1);
  });

  it('throws 422 when user input violates moderation', async () => {
    mockModeration.check.mockImplementation((text) => (
      text.includes('去死')
        ? { allowed: false, reason: 'blocklist_match' }
        : { allowed: true }
    ));

    const agent = createAgent();
    await expect(agent.continueDiscussion({
      userId: 'u1',
      topic: 'test',
      personas: [],
      context: { topic: 'test' },
      history: [],
      userContent: '你去死吧',
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 408 when continue generation times out', async () => {
    const err = new Error('timeout');
    err.code = 'TIMEOUT';
    mockAi.simulateTurns.mockRejectedValueOnce(err);

    const agent = createAgent();
    await expect(agent.continueDiscussion({
      userId: 'u1',
      topic: 'test',
      personas: [],
      context: { topic: 'test' },
      history: [],
      userContent: '继续聊聊',
    })).rejects.toMatchObject({ statusCode: 408 });
  });

  it('rethrows AppError from AI layer', async () => {
    mockAi.simulateTurns.mockRejectedValueOnce(new AppError(503, 'service_unavailable', 'AI down'));

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('throws 422 when continue AI output violates moderation', async () => {
    mockModeration.check.mockImplementation((text) => (
      text.includes('官方宣布')
        ? { allowed: false, reason: 'false_official_claim' }
        : { allowed: true }
    ));
    mockAi.simulateTurns.mockResolvedValueOnce({
      turns: [{ personaId: 'persona-liverpool', content: '官方宣布引援' }],
    });

    const agent = createAgent();
    await expect(agent.continueDiscussion({
      userId: 'u1',
      topic: 'test',
      personas: [],
      context: { topic: 'test' },
      history: [],
      userContent: '继续讨论',
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 503 when AI provider rate limits', async () => {
    const err = new Error('AI request failed: 429');
    err.statusCode = 429;
    mockAi.simulateTurns.mockRejectedValueOnce(err);

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toMatchObject({
      statusCode: 503,
      error: 'service_unavailable',
      message: 'AI 服务请求过于频繁，请稍后再试',
    });
  });

  it('throws 503 with balance hint when provider reports insufficient quota', async () => {
    const err = new Error('AI request failed: 429');
    err.statusCode = 429;
    err.details = JSON.stringify({
      error: { code: '1113', message: '余额不足或无可用资源包,请充值。' },
    });
    mockAi.simulateTurns.mockRejectedValueOnce(err);

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toMatchObject({
      statusCode: 503,
      error: 'service_unavailable',
      message: 'AI 服务余额不足或无可用资源包，请充值后重试',
    });
  });

  it('rethrows unexpected AI errors', async () => {
    mockAi.simulateTurns.mockRejectedValueOnce(new Error('unexpected'));

    const agent = createAgent();
    await expect(agent.createInitialDiscussion({
      userId: 'u1',
      topic: 'test',
      personaIds: ['persona-arsenal', 'persona-liverpool'],
    })).rejects.toThrow('unexpected');
  });
});
