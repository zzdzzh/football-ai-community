#!/usr/bin/env node
/**
 * 校验 commit message 中的 [AI Gen_<HMAC>] 前缀（供 commit-msg hook 调用）。
 *
 * 用法:
 *   node .harness/scripts/verify-ai-gen-commit.mjs <commit-msg-file>
 */

import { readFileSync } from 'node:fs';
import {
  findProjectRoot,
  hasAiGenPrefix,
  loadSecret,
  verifyCommitMessage,
} from './lib/ai-gen-watermark.mjs';

function main() {
  const msgFile = process.argv[2];
  if (!msgFile) {
    console.error('Usage: node verify-ai-gen-commit.mjs <commit-msg-file>');
    process.exit(1);
  }

  const raw = readFileSync(msgFile, 'utf8');
  const message = raw.replace(/^\uFEFF/, '');
  if (!hasAiGenPrefix(message)) {
    process.exit(0);
  }

  const projectRoot = findProjectRoot();
  const secret = loadSecret(projectRoot);
  const result = verifyCommitMessage(message, secret);

  if (!result.ok) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
