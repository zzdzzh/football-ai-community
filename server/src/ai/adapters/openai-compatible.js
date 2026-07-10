export class OpenAiCompatibleAdapter {
  constructor({ baseUrl, apiKey, model, timeoutMs }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async complete({ systemPrompt, userPrompt }) {
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
}
