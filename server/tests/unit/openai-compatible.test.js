import { describe, expect, it, jest } from '@jest/globals';
import {
  OpenAiCompatibleAdapter,
  isRetryableAiError,
  parseAiProviderError,
} from '../../src/ai/adapters/openai-compatible.js';

describe('parseAiProviderError', () => {
  it('parses BigModel error payload', () => {
    expect(parseAiProviderError(JSON.stringify({
      error: { code: '1113', message: '余额不足或无可用资源包,请充值。' },
    }))).toEqual({
      code: '1113',
      message: '余额不足或无可用资源包,请充值。',
    });
  });
});

describe('isRetryableAiError', () => {
  it('does not retry balance errors', () => {
    const body = JSON.stringify({ error: { code: '1113', message: '余额不足' } });
    expect(isRetryableAiError(429, body)).toBe(false);
  });

  it('retries overload 429', () => {
    const body = JSON.stringify({ error: { message: '该模型当前访问量过大，请您稍后再试' } });
    expect(isRetryableAiError(429, body)).toBe(true);
  });

  it('retries 502/503/504', () => {
    expect(isRetryableAiError(502, '')).toBe(true);
    expect(isRetryableAiError(503, '')).toBe(true);
    expect(isRetryableAiError(504, '')).toBe(true);
  });
});

describe('OpenAiCompatibleAdapter', () => {
  it('retries transient 429 then succeeds', async () => {
    const overloadBody = JSON.stringify({
      error: { message: '该模型当前访问量过大，请您稍后再试' },
    });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => overloadBody,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
          model: 'glm-4.7-flash',
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      });

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      model: 'glm-4.7-flash',
      timeoutMs: 5000,
      maxRetries: 2,
      retryDelaysMs: [1, 1],
    });

    const result = await adapter.complete({ userPrompt: 'ping' });
    expect(result.text).toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry balance 429', async () => {
    const balanceBody = JSON.stringify({
      error: { code: '1113', message: '余额不足或无可用资源包,请充值。' },
    });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => balanceBody,
    });

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
      model: 'glm-4.7-flash',
      timeoutMs: 5000,
      maxRetries: 2,
      retryDelaysMs: [1, 1],
    });

    await expect(adapter.complete({ userPrompt: 'ping' })).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
