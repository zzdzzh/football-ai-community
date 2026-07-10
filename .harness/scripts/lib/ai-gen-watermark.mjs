import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const AI_GEN_SUFFIX_RE = /\s*\[AI Gen_[^\]]+\]\s*$/;
export const AI_GEN_WATERMARK_RE = /\[AI Gen_([^\]]+)\]/;

/**
 * 从项目根向上查找 .harness 目录（支持脚本位于 .harness/scripts 下）。
 */
export function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, '.harness'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

export function resolveSecretPath(projectRoot = findProjectRoot()) {
  return join(projectRoot, '.harness', '.ai-gen-secret');
}

/**
 * 读取 HMAC 密钥：优先环境变量 HARNESS_AI_GEN_SECRET，其次 .harness/.ai-gen-secret。
 */
export function loadSecret(projectRoot = findProjectRoot()) {
  const fromEnv = process.env.HARNESS_AI_GEN_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const secretPath = resolveSecretPath(projectRoot);
  if (!existsSync(secretPath)) {
    throw new Error(
      `AI Gen secret not found at ${secretPath}. ` +
        'Run install.sh or set HARNESS_AI_GEN_SECRET.'
    );
  }

  const secret = readFileSync(secretPath, 'utf8').trim();
  if (!secret) {
    throw new Error(`AI Gen secret file is empty: ${secretPath}`);
  }
  return secret;
}

export function stripAiGenSuffix(message) {
  return message.replace(AI_GEN_SUFFIX_RE, '').trim();
}

export function buildPayload(messageBody) {
  return stripAiGenSuffix(messageBody);
}

export function computeWatermark(messageBody, secret) {
  const payload = buildPayload(messageBody);
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url').slice(0, 12);
}

export function formatCommitMessage(messageBody, secret) {
  const body = stripAiGenSuffix(messageBody);
  const watermark = computeWatermark(body, secret);
  return `${body} [AI Gen_${watermark}]`;
}

export function extractWatermark(message) {
  const match = message.match(AI_GEN_WATERMARK_RE);
  return match ? match[1] : null;
}

export function hasAiGenWatermark(message) {
  return AI_GEN_WATERMARK_RE.test(message);
}

export function verifyCommitMessage(fullMessage, secret) {
  if (!hasAiGenWatermark(fullMessage)) {
    return { ok: true, skipped: true };
  }

  const actual = extractWatermark(fullMessage);
  if (!actual) {
    return { ok: false, error: 'Malformed [AI Gen_] watermark.' };
  }

  const body = stripAiGenSuffix(fullMessage);
  const expected = computeWatermark(body, secret);

  if (actual !== expected) {
    return {
      ok: false,
      error: `AI Gen watermark mismatch. Expected [AI Gen_${expected}], got [AI Gen_${actual}].`,
    };
  }

  return { ok: true, watermark: actual };
}

export function getStagedDiff(cwd = process.cwd()) {
  try {
    return execSync('git diff --cached', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new Error(`Failed to read staged diff: ${err.message}`);
  }
}

export function hasStagedChanges(cwd = process.cwd()) {
  return getStagedDiff(cwd).trim().length > 0;
}
