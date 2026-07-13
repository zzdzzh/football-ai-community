export function parseAiProviderError(errorBody) {
  if (typeof errorBody !== 'string' || !errorBody) {
    return { code: null, message: null };
  }
  try {
    const parsed = JSON.parse(errorBody);
    return {
      code: parsed?.error?.code ?? null,
      message: parsed?.error?.message ?? parsed?.message ?? null,
    };
  } catch {
    return { code: null, message: null };
  }
}

export function isRetryableAiError(statusCode, errorBody) {
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return true;
  }
  if (statusCode !== 429) {
    return false;
  }
  const { code, message } = parseAiProviderError(errorBody);
  if (code === '1113' || /余额|资源包|充值/.test(message ?? '')) {
    return false;
  }
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class OpenAiCompatibleAdapter {
  constructor({ baseUrl, apiKey, model, timeoutMs, maxRetries = 2, retryDelaysMs = [2000, 4000] }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryDelaysMs = retryDelaysMs;
  }

  async requestOnce({ systemPrompt, userPrompt }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`AI request failed: ${response.status}`);
        error.statusCode = response.status;
        error.details = errorBody;
        throw error;
      }

      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content ?? '',
        model: data.model ?? this.model,
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async complete({ systemPrompt, userPrompt }) {
    let lastError = null;
    const maxAttempts = this.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await this.requestOnce({ systemPrompt, userPrompt });
      } catch (err) {
        lastError = err;
        const canRetry = attempt < maxAttempts - 1
          && isRetryableAiError(err.statusCode, err.details);
        if (!canRetry) {
          throw err;
        }
        await sleep(this.retryDelaysMs[attempt] ?? this.retryDelaysMs.at(-1) ?? 2000);
      }
    }

    throw lastError;
  }
}
