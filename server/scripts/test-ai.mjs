import { createAiContentService } from '../src/ai/factory.js';
import { getDb } from '../src/db/connection.js';

const ai = createAiContentService();

try {
  const result = await ai.generate({
    agentId: 'news',
    requestType: 'generate',
    systemPrompt: '你是足球新闻编辑，只输出合法 JSON。',
    userPrompt: '请用 JSON 回复: {"summary":"测试摘要","key_points":["点1"],"event_key":"test-event"}',
  });
  console.log('SUCCESS');
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log('ERROR:', err.message);
  if (err.details) {
    console.log('DETAILS:', err.details.slice(0, 1000));
  }
}

console.log('\n--- Recent interaction logs ---');
const db = getDb();
const rows = db.prepare(`
  SELECT status, error_message, model, duration_ms, created_at
  FROM agent_interaction_logs
  ORDER BY created_at DESC
  LIMIT 5
`).all();
console.log(JSON.stringify(rows, null, 2));
