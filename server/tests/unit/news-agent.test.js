import { describe, expect, it } from '@jest/globals';
import {
  DEGRADED_SUMMARY_MARKER,
  isDegradedSummary,
} from '../../src/agents/news-agent.js';

describe('isDegradedSummary', () => {
  it('detects degraded summary marker', () => {
    expect(isDegradedSummary('标题（摘要生成失败，请查看原文）')).toBe(true);
  });

  it('returns false for normal summary', () => {
    expect(isDegradedSummary('这是一条正常摘要')).toBe(false);
  });

  it('returns false for empty summary', () => {
    expect(isDegradedSummary(undefined)).toBe(false);
    expect(isDegradedSummary('')).toBe(false);
  });

  it('exports stable marker constant', () => {
    expect(DEGRADED_SUMMARY_MARKER).toBe('摘要生成失败');
  });
});
