import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';

/** @type {Map<string, number[]>} */
const hitBuckets = new Map();

function bucketKey(userId, agentId) {
  return `${userId}::${agentId}`;
}

function prune(timestamps, windowMs, now) {
  const cutoff = now - windowMs;
  return timestamps.filter((ts) => ts > cutoff);
}

export function resetAiRateLimitStore() {
  hitBuckets.clear();
}

/**
 * 对同一用户 + Agent 的 AI 提问做滑动窗口限流。
 * maxPerWindow <= 0 时关闭限流（测试默认关闭）。
 * 可选覆盖参数仅用于单元测试。
 */
export function assertAiRateLimit({
  userId,
  agentId,
  maxPerWindow = config.aiRateLimit?.maxPerWindow ?? 0,
  windowMs = config.aiRateLimit?.windowMs ?? 60000,
} = {}) {
  if (!userId || !agentId || maxPerWindow <= 0) {
    return;
  }

  const key = bucketKey(userId, agentId);
  const now = Date.now();
  const next = prune(hitBuckets.get(key) ?? [], windowMs, now);

  if (next.length >= maxPerWindow) {
    throw new AppError(429, 'rate_limited', '提问过于频繁，请稍后再试');
  }

  next.push(now);
  hitBuckets.set(key, next);
}
