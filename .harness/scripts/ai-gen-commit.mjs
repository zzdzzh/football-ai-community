#!/usr/bin/env node
/**
 * 生成带 [AI Gen_<HMAC>] 前缀的 commit message，可选直接 git commit。
 *
 * 用法:
 *   node .harness/scripts/ai-gen-commit.mjs --message "feat(auth): T013 ..."
 *   node .harness/scripts/ai-gen-commit.mjs --commit "feat(auth): T013 ..."
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findProjectRoot,
  formatCommitMessage,
  hasStagedChanges,
  loadSecret,
} from './lib/ai-gen-watermark.mjs';

function printUsage() {
  console.error(`Usage:
  node ai-gen-commit.mjs --message "<body>"
  node ai-gen-commit.mjs --commit "<body>"

Options:
  --message   仅输出带水印的 commit message（不提交）
  --commit    计算水印并执行 git commit -F
  --help      显示帮助`);
}

function parseArgs(argv) {
  let mode = null;
  let body = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--message' || arg === '--commit') {
      mode = arg.slice(2);
      body = argv[i + 1];
      if (!body) {
        throw new Error(`Missing value for --${mode}`);
      }
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!mode || !body) {
    printUsage();
    process.exit(1);
  }

  return { mode, body };
}

function runGitCommit(message, projectRoot) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-gen-commit-'));
  const msgFile = join(dir, 'COMMIT_EDITMSG');
  try {
    writeFileSync(msgFile, message, 'utf8');
    const result = spawnSync('git', ['commit', '-F', msgFile], {
      cwd: projectRoot,
      stdio: 'inherit',
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(`git commit failed with exit code ${result.status ?? 'unknown'}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const { mode, body } = parseArgs(process.argv.slice(2));
  const projectRoot = findProjectRoot();

  if (!hasStagedChanges(projectRoot)) {
    console.error('ERROR: No staged changes. Run git add before ai-gen-commit.');
    process.exit(1);
  }

  const secret = loadSecret(projectRoot);
  const formatted = formatCommitMessage(body, secret);

  if (mode === 'message') {
    process.stdout.write(`${formatted}\n`);
    return;
  }

  runGitCommit(formatted, projectRoot);
  console.log(`Committed with AI Gen watermark: ${formatted.split('\n')[0]}`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
