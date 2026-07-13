import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ContentModerationService,
  loadBlocklistRules,
} from '../../src/services/content-moderation-service.js';

describe('ContentModerationService', () => {
  it('allows clean content', () => {
    const service = new ContentModerationService({
      rules: [{ type: 'keyword', value: '去死' }],
    });
    expect(service.check('今天比赛很精彩')).toEqual({ allowed: true });
  });

  it('rejects null and undefined content', () => {
    const service = new ContentModerationService({ rules: [] });
    expect(service.check(null)).toEqual({ allowed: false, reason: 'empty_content' });
    expect(service.check(undefined)).toEqual({ allowed: false, reason: 'empty_content' });
  });

  it('rejects empty and whitespace-only content', () => {
    const service = new ContentModerationService({ rules: [] });
    expect(service.check('')).toEqual({ allowed: false, reason: 'empty_content' });
    expect(service.check('   ')).toEqual({ allowed: false, reason: 'empty_content' });
  });

  it('rejects blocklist keyword matches', () => {
    const service = new ContentModerationService({
      rules: [{ type: 'keyword', value: '去死' }],
    });
    expect(service.check('你去死吧')).toEqual({ allowed: false, reason: 'blocklist_match' });
  });

  it('rejects blocklist regex matches', () => {
    const service = new ContentModerationService({
      rules: [{ type: 'regex', value: /垃圾/i }],
    });
    expect(service.check('真是垃圾裁判')).toEqual({ allowed: false, reason: 'blocklist_match' });
  });

  it('rejects false official claim patterns', () => {
    const service = new ContentModerationService({ rules: [] });
    expect(service.check('俱乐部官方宣布签下新援')).toEqual({
      allowed: false,
      reason: 'false_official_claim',
    });
  });

  it('loads rules from blocklist file and ignores comments', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fan-blocklist-'));
    const filePath = join(dir, 'blocklist.txt');
    writeFileSync(filePath, '# comment\n去死\n/垃圾/\ninvalid-regex\n', 'utf8');
    const rules = loadBlocklistRules(filePath);
    expect(rules.length).toBeGreaterThanOrEqual(2);
    const service = new ContentModerationService({ rules });
    expect(service.check('垃圾裁判')).toEqual({ allowed: false, reason: 'blocklist_match' });
  });

  it('returns empty rules when blocklist file is missing', () => {
    const rules = loadBlocklistRules(join(tmpdir(), 'missing-blocklist.txt'));
    expect(rules).toEqual([]);
  });

  it('ignores invalid regex lines in blocklist file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fan-blocklist-invalid-'));
    const filePath = join(dir, 'blocklist.txt');
    writeFileSync(filePath, '/[/\n', 'utf8');
    const rules = loadBlocklistRules(filePath);
    expect(rules).toEqual([]);
  });
});
