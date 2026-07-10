import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPayload,
  computeWatermark,
  extractWatermark,
  formatCommitMessage,
  hasAiGenPrefix,
  stripAiGenPrefix,
  verifyCommitMessage,
} from '../lib/ai-gen-watermark.mjs';

const SECRET = 'test-secret-key-for-unit-tests';

describe('ai-gen-watermark', () => {
  it('相同 message + secret 产生相同 watermark', () => {
    const body = 'feat(test): T001 add foo';

    const w1 = computeWatermark(body, SECRET);
    const w2 = computeWatermark(body, SECRET);

    assert.equal(w1, w2);
    assert.equal(w1.length, 12);
  });

  it('修改 message 后 watermark 变化', () => {
    const body = 'feat(test): T001 add foo';

    const base = computeWatermark(body, SECRET);
    const changedBody = computeWatermark('feat(test): T002 add foo', SECRET);

    assert.notEqual(base, changedBody);
  });

  it('buildPayload 仅包含 message 正文', () => {
    const body = 'feat(test): T001 add foo';
    assert.equal(buildPayload(body), body);
    assert.equal(buildPayload(`[AI Gen_abc] ${body}`), body);
  });

  it('formatCommitMessage 生成带前缀的 message', () => {
    const body = 'feat(test): T001 add foo';
    const formatted = formatCommitMessage(body, SECRET);

    assert.match(formatted, /^\[AI Gen_[A-Za-z0-9_-]{12}\] feat\(test\): T001 add foo$/);
    assert.equal(stripAiGenPrefix(formatted), body);
  });

  it('stripAiGenPrefix 去掉已有前缀', () => {
    const body = 'feat(test): T001 add foo';
    const prefixed = `[AI Gen_abc123xyz012] ${body}`;

    assert.equal(stripAiGenPrefix(prefixed), body);
    assert.equal(stripAiGenPrefix(body), body);
  });

  it('verifyCommitMessage 验证合法前缀', () => {
    const body = 'feat(test): T001 add foo';
    const formatted = formatCommitMessage(body, SECRET);

    const result = verifyCommitMessage(formatted, SECRET);
    assert.equal(result.ok, true);
    assert.equal(result.watermark, extractWatermark(formatted));
  });

  it('verifyCommitMessage 拒绝伪造前缀', () => {
    const fake = '[AI Gen_fakewater12] feat(test): T001 add foo';

    const result = verifyCommitMessage(fake, SECRET);
    assert.equal(result.ok, false);
    assert.match(result.error, /watermark mismatch/i);
  });

  it('无前缀时 verify 跳过', () => {
    const result = verifyCommitMessage('chore: update progress', SECRET);
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  it('hasAiGenPrefix 识别前缀', () => {
    assert.equal(hasAiGenPrefix('[AI Gen_abc] feat: x'), true);
    assert.equal(hasAiGenPrefix('feat: x'), false);
  });
});
