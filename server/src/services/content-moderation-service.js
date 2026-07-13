import { readFileSync, existsSync } from 'node:fs';
import { config } from '../config/index.js';

const OFFICIAL_CLAIM_PATTERN = /(官方|俱乐部|足协).{0,8}(宣布|官宣|确认)/i;

function parseBlocklistLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  if (trimmed.startsWith('/') && trimmed.endsWith('/')) {
    const source = trimmed.slice(1, -1);
    try {
      return { type: 'regex', value: new RegExp(source, 'i') };
    } catch {
      return null;
    }
  }
  return { type: 'keyword', value: trimmed.toLowerCase() };
}

export function loadBlocklistRules(blocklistPath = config.contentModeration.blocklistPath) {
  if (!existsSync(blocklistPath)) {
    return [];
  }
  const content = readFileSync(blocklistPath, 'utf8');
  return content
    .split(/\r?\n/)
    .map(parseBlocklistLine)
    .filter(Boolean);
}

export class ContentModerationService {
  constructor({ blocklistPath, rules } = {}) {
    this.rules = rules ?? loadBlocklistRules(blocklistPath);
  }

  check(text) {
    if (text === undefined || text === null) {
      return { allowed: false, reason: 'empty_content' };
    }
    const normalized = String(text).trim();
    if (!normalized) {
      return { allowed: false, reason: 'empty_content' };
    }

    const lower = normalized.toLowerCase();
    for (const rule of this.rules) {
      if (rule.type === 'keyword' && lower.includes(rule.value)) {
        return { allowed: false, reason: 'blocklist_match' };
      }
      if (rule.type === 'regex' && rule.value.test(normalized)) {
        return { allowed: false, reason: 'blocklist_match' };
      }
    }

    if (OFFICIAL_CLAIM_PATTERN.test(normalized)) {
      return { allowed: false, reason: 'false_official_claim' };
    }

    return { allowed: true };
  }
}

export const defaultContentModerationService = new ContentModerationService();

export function checkContent(text, service = defaultContentModerationService) {
  return service.check(text);
}
