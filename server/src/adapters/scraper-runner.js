import { spawn } from 'node:child_process';
import { config } from '../config/index.js';

export function runScraperCli(args, { timeoutMs = 600000 } = {}) {
  if (config.isTest) {
    throw new Error('测试环境不调用真实爬虫');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.scraper.pythonPath,
      ['-m', 'scraper', ...args],
      {
        cwd: config.scraper.dir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          SCRAPER_USE_TRANSFERMARKT: config.scraper.useTransfermarkt ? '1' : '0',
        },
      },
    );

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('爬虫执行超时'));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        let message = stderr.trim() || `爬虫退出码 ${code}`;
        try {
          const parsed = JSON.parse(stderr);
          message = parsed.error ?? message;
        } catch {
          // keep stderr text
        }
        reject(new Error(message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`爬虫输出非 JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

export async function syncLeagueFromScraper(leagueCode, { includeFbref = true, playersOnly = false } = {}) {
  const args = ['sync-league', '--league', leagueCode, '--delay', String(config.scraper.requestDelaySec)];
  if (!includeFbref) {
    args.push('--no-fbref');
  }
  if (playersOnly) {
    args.push('--players-only');
  }
  // 默认不启 Transfermarkt；仅当显式配置时附加（避免人机验证拖垮同步）
  if (config.scraper.useTransfermarkt) {
    args.push('--transfermarkt');
  }
  // 含 FBref 时单联赛常超过 10 分钟；俱乐部联赛与世界杯统一给足超时
  const timeoutMs = 1800000;
  return runScraperCli(args, { timeoutMs });
}

export async function fetchFbrefStatsFromScraper(leagueCode, { seasonYear } = {}) {
  const args = ['fbref-stats', '--league', leagueCode];
  if (seasonYear != null) {
    args.push('--season-year', String(seasonYear));
  }
  return runScraperCli(args, { timeoutMs: 300000 });
}

export async function fetchScraperMatchDetail(sofascoreMatchId) {
  return runScraperCli(['match-detail', '--match-id', sofascoreMatchId], { timeoutMs: 60000 });
}
