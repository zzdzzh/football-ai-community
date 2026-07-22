import { spawn } from 'node:child_process';
import { config } from '../config/index.js';

function scraperSpawnOptions(extra = {}) {
  const pythonPath = config.scraper.pythonPath;
  const pathLike = /[\\/]/.test(pythonPath) || /^[a-zA-Z]:/.test(pythonPath);
  return {
    cwd: config.scraper.dir,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      SCRAPER_USE_TRANSFERMARKT: config.scraper.useTransfermarkt ? '1' : '0',
      FOOTBALL_DATA_WC_SEASON: String(config.footballData.wcSeason),
    },
    // 裸命令在 Windows 上无 shell 时常 ENOENT；已解析为绝对路径时不必开 shell
    shell: !pathLike,
    windowsHide: true,
    ...extra,
  };
}

export function runScraperCli(args, { timeoutMs = 600000 } = {}) {
  if (config.isTest) {
    throw new Error('测试环境不调用真实爬虫');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.scraper.pythonPath,
      ['-m', 'scraper', ...args],
      scraperSpawnOptions(),
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
      if (err?.code === 'ENOENT') {
        reject(new Error(
          `找不到 SCRAPER_PYTHON「${config.scraper.pythonPath}」（ENOENT）。`
          + '请在运行后台的那台机器上改为真实存在的 Python 路径后重启',
        ));
        return;
      }
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

export async function searchCareerFromScraper(query, { limit = 20, timeoutMs = 15000 } = {}) {
  return runScraperCli(
    ['career-search', '--q', String(query), '--limit', String(limit), '--delay', String(config.scraper.requestDelaySec)],
    { timeoutMs },
  );
}

export async function fetchCareerProfileFromScraper(tmId, { slug = '-', timeoutMs = 60000 } = {}) {
  return runScraperCli(
    [
      'career-profile',
      '--tm-id', String(tmId),
      '--slug', String(slug || '-'),
      '--delay', String(config.scraper.requestDelaySec),
    ],
    { timeoutMs },
  );
}

/** @type {import('node:child_process').ChildProcess | null} */
let tmCookieRefreshProc = null;

export function isTmCaptchaError(message) {
  return typeof message === 'string' && message.includes('人机验证');
}

/**
 * 检测到 Transfermarkt 人机验证时，后台拉起有头 Playwright 刷新 Cookie。
 * 仍需人工在弹出的浏览器里完成验证；脚本 --auto 会在验证消失后自动落盘。
 * @returns {{ started: boolean, reason: string }}
 */
export function triggerTmCookieRefresh(reason = '') {
  if (config.isTest) {
    return { started: false, reason: 'test' };
  }
  if (!config.careerSync.autoRefreshTmCookies) {
    return { started: false, reason: 'disabled' };
  }
  if (tmCookieRefreshProc && !tmCookieRefreshProc.killed) {
    return { started: false, reason: 'already_running' };
  }

  const scriptPath = 'scripts/refresh_tm_cookies.py';
  const timeoutSec = String(config.careerSync.tmCookieRefreshTimeoutSec ?? 300);
  const proc = spawn(
    config.scraper.pythonPath,
    [scriptPath, '--auto', '--timeout-sec', timeoutSec],
    scraperSpawnOptions({
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  tmCookieRefreshProc = proc;

  console.log(JSON.stringify({
    level: 'info',
    type: 'tm_cookie_refresh_started',
    reason: String(reason).slice(0, 200),
    pid: proc.pid,
  }));

  proc.stdout?.on('data', (chunk) => {
    const text = chunk.toString('utf8').trim();
    if (text) {
      console.log(JSON.stringify({
        level: 'info',
        type: 'tm_cookie_refresh_stdout',
        message: text.slice(0, 500),
      }));
    }
  });
  proc.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf8').trim();
    if (text) {
      console.log(JSON.stringify({
        level: 'warn',
        type: 'tm_cookie_refresh_stderr',
        message: text.slice(0, 500),
      }));
    }
  });
  proc.on('error', (err) => {
    console.error(JSON.stringify({
      level: 'error',
      type: 'tm_cookie_refresh_spawn_failed',
      message: err?.message ?? String(err),
    }));
    if (tmCookieRefreshProc === proc) tmCookieRefreshProc = null;
  });
  proc.on('close', (code) => {
    console.log(JSON.stringify({
      level: 'info',
      type: 'tm_cookie_refresh_finished',
      code,
    }));
    if (tmCookieRefreshProc === proc) tmCookieRefreshProc = null;
  });

  return { started: true, reason: 'spawned' };
}
