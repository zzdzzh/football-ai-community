import {
  assertAiRateLimit,
  resetAiRateLimitStore,
} from '../../src/services/ai-rate-limit.js';

describe('assertAiRateLimit', () => {
  beforeEach(() => {
    resetAiRateLimitStore();
  });

  it('allows requests under the limit', () => {
    expect(() => assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 3 })).not.toThrow();
    expect(() => assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 3 })).not.toThrow();
    expect(() => assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 3 })).not.toThrow();
  });

  it('throws 429 when exceeding limit for same user+agent', () => {
    assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 2 });
    assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 2 });
    try {
      assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 2 });
      throw new Error('expected rate limit error');
    } catch (err) {
      expect(err.statusCode).toBe(429);
      expect(err.error).toBe('rate_limited');
      expect(err.message).toMatch(/稍后再试/);
    }
  });

  it('isolates limits by agent and by user', () => {
    assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 1 });
    expect(() => assertAiRateLimit({ userId: 'u1', agentId: 'scout', maxPerWindow: 1 })).not.toThrow();
    expect(() => assertAiRateLimit({ userId: 'u2', agentId: 'stats', maxPerWindow: 1 })).not.toThrow();
  });

  it('is disabled when maxPerWindow is 0', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => assertAiRateLimit({ userId: 'u1', agentId: 'stats', maxPerWindow: 0 })).not.toThrow();
    }
  });
});
