import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

function isPathLike(value) {
  return /[\\/]/.test(value) || /^[a-zA-Z]:/.test(value);
}

/** 在 PATH 中查找可执行文件，返回绝对路径或 null */
function resolveCommandOnPath(cmd) {
  try {
    if (platform() === 'win32') {
      const out = execFileSync('where.exe', [cmd], {
        encoding: 'utf8',
        windowsHide: true,
      });
      const first = out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && existsSync(line) && !line.toLowerCase().includes('\\windowsapps\\'));
      return first || null;
    }
    const out = execFileSync('/bin/sh', ['-c', `command -v ${JSON.stringify(cmd)}`], {
      encoding: 'utf8',
    });
    const first = out.trim();
    return first && existsSync(first) ? first : null;
  } catch {
    return null;
  }
}

/** Windows py launcher → 真实 python.exe */
function resolveViaPyLauncher() {
  if (platform() !== 'win32') return null;
  try {
    const out = execFileSync('py', ['-3', '-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const first = out.trim().split(/\r?\n/).find(Boolean);
    return first && existsSync(first) ? first : null;
  } catch {
    return null;
  }
}

/**
 * 解析可用的 scraper Python：配置路径不存在时回退到 scraper venv / PATH / py launcher。
 * @param {string} configured
 * @param {string} scraperDir
 */
function resolveScraperPythonPath(configured, scraperDir) {
  const raw = String(configured ?? '').trim() || 'python';
  const pathLike = isPathLike(raw);

  /** @type {string[]} */
  const fileCandidates = [];

  if (pathLike) {
    fileCandidates.push(isAbsolute(raw) ? raw : resolve(scraperDir, raw));
    fileCandidates.push(resolve(__dirname, '../..', raw));
  }

  fileCandidates.push(
    resolve(scraperDir, '.venv-soccerdata', 'Scripts', 'python.exe'),
    resolve(scraperDir, '.venv-soccerdata', 'bin', 'python'),
    resolve(scraperDir, '.venv-soccerdata', 'bin', 'python3'),
    resolve(scraperDir, '.venv', 'Scripts', 'python.exe'),
    resolve(scraperDir, '.venv', 'bin', 'python'),
    resolve(scraperDir, '.venv', 'bin', 'python3'),
  );

  // 常见系统安装位置
  if (platform() === 'win32') {
    fileCandidates.push(
      'C:\\ProgramData\\anaconda3\\python.exe',
      'C:\\Python311\\python.exe',
      'C:\\Python312\\python.exe',
    );
  } else {
    fileCandidates.push('/usr/bin/python3', '/usr/local/bin/python3', '/usr/bin/python');
  }

  for (const candidate of fileCandidates) {
    if (existsSync(candidate)) {
      if (candidate !== raw) {
        console.log(JSON.stringify({
          level: 'info',
          type: 'scraper_python_resolved',
          configured: raw,
          resolved: candidate,
        }));
      }
      return candidate;
    }
  }

  const pathCmds = pathLike
    ? []
    : [raw, raw === 'python' ? 'python3' : null, raw === 'python3' ? 'python' : null, 'python.exe']
      .filter(Boolean);
  for (const cmd of pathCmds) {
    const found = resolveCommandOnPath(cmd);
    if (found) {
      console.log(JSON.stringify({
        level: 'info',
        type: 'scraper_python_resolved',
        configured: raw,
        resolved: found,
        via: 'PATH',
      }));
      return found;
    }
  }

  const viaPy = resolveViaPyLauncher();
  if (viaPy) {
    console.log(JSON.stringify({
      level: 'info',
      type: 'scraper_python_resolved',
      configured: raw,
      resolved: viaPy,
      via: 'py_launcher',
    }));
    return viaPy;
  }

  console.warn(JSON.stringify({
    level: 'warn',
    type: 'scraper_python_unresolved',
    configured: raw,
    scraperDir,
    message: '未找到可用 Python，将使用配置值原样 spawn（可能 ENOENT）',
  }));
  return raw;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),
  DATABASE_PATH: z.string().default('./data/community.db'),
  AI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: z.coerce.number().default(28000),
  /** 交互式 AI（球员推荐 / 球迷对话 / Stats / Tactical / 关系叙事等用户触发） */
  AI_INTERACTIVE_BASE_URL: z.string().url().optional(),
  AI_INTERACTIVE_API_KEY: z.string().optional(),
  AI_INTERACTIVE_MODEL: z.string().optional(),
  AI_INTERACTIVE_TIMEOUT_MS: z.coerce.number().optional(),
  AI_MAX_RETRIES: z.coerce.number().default(4),
  AI_RETRY_DELAYS_MS: z.string().default('3000,5000,8000,12000'),
  NEWS_SUMMARY_DELAY_MS: z.coerce.number().default(1500),
  INTERNAL_API_KEY: z.string().default('dev-internal-key'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  FOOTBALL_DATA_API_KEY: z.string().default(''),
  FOOTBALL_DATA_BASE_URL: z.string().url().default('https://api.football-data.org/v4'),
  MATCH_SYNC_CRON: z.string().optional(),
  MATCH_REPORT_CRON: z.string().default('*/5 * * * *'),
  PLAYER_SYNC_CRON: z.string().default('0 4 * * *'),
  FOOTBALL_DATA_WC_SEASON: z.coerce.number().default(2026),
  DATA_SOURCE: z.enum(['football-data', 'scraper']).default('scraper'),
  SCRAPER_PYTHON: z.string().default('python'),
  SCRAPER_DIR: z.string().default('../scraper'),
  SCRAPER_REQUEST_DELAY_SEC: z.coerce.number().default(1.5),
  SCRAPER_USE_TRANSFERMARKT: z.enum(['0', '1', 'true', 'false', 'yes', 'no', 'on', 'off']).default('0'),
  FAN_CONTINUE_TIMEOUT_MS: z.coerce.number().default(30000),
  CONTENT_MODERATION_BLOCKLIST: z.string().default('./config/content-blocklist.txt'),
  CAREER_SYNC_TTL_DAYS: z.coerce.number().default(7),
  RELATIONSHIP_MAX_HOPS: z.coerce.number().default(6),
  CAREER_SYNC_TIMEOUT_MS: z.coerce.number().default(60000),
  /** 履历同步遇 TM 人机验证时，是否自动拉起 refresh_tm_cookies.py --auto */
  CAREER_AUTO_REFRESH_TM_COOKIES: z.enum(['0', '1', 'true', 'false', 'yes', 'no', 'on', 'off']).default('1'),
  CAREER_TM_COOKIE_REFRESH_TIMEOUT_SEC: z.coerce.number().default(300),
  /** 同一用户对同一 Agent 每窗口最大 AI 提问次数；0=关闭。测试环境默认 0 */
  AI_RATE_LIMIT_MAX: z.coerce.number().optional(),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  databasePath: resolve(__dirname, '../..', env.DATABASE_PATH),
  ai: {
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
    retryDelaysMs: env.AI_RETRY_DELAYS_MS.split(',').map((v) => Number(v.trim())).filter((v) => v > 0),
  },
  /** 用户输入触发的 AI；未单独配置时回退到 ai（自动内容：战报 / 新闻摘要） */
  aiInteractive: {
    baseUrl: env.AI_INTERACTIVE_BASE_URL ?? env.AI_BASE_URL,
    apiKey: env.AI_INTERACTIVE_API_KEY ?? env.AI_API_KEY,
    model: env.AI_INTERACTIVE_MODEL ?? env.AI_MODEL,
    timeoutMs: env.AI_INTERACTIVE_TIMEOUT_MS ?? env.AI_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
    retryDelaysMs: env.AI_RETRY_DELAYS_MS.split(',').map((v) => Number(v.trim())).filter((v) => v > 0),
  },
  newsSummaryDelayMs: env.NEWS_SUMMARY_DELAY_MS,
  internalApiKey: env.INTERNAL_API_KEY,
  adminEmail: env.ADMIN_EMAIL,
  adminPassword: env.ADMIN_PASSWORD,
  footballData: {
    apiKey: env.FOOTBALL_DATA_API_KEY,
    baseUrl: env.FOOTBALL_DATA_BASE_URL,
    wcSeason: env.FOOTBALL_DATA_WC_SEASON,
  },
  matchSyncCron: env.MATCH_SYNC_CRON
    ?? (env.DATA_SOURCE === 'scraper' ? '0 6 * * *' : '*/30 * * * *'),
  matchReportCron: env.MATCH_REPORT_CRON,
  playerSyncCron: env.PLAYER_SYNC_CRON,
  dataSource: env.NODE_ENV === 'test' ? 'football-data' : env.DATA_SOURCE,
  scraper: (() => {
    const dir = resolve(__dirname, '../..', env.SCRAPER_DIR);
    return {
      pythonPath: resolveScraperPythonPath(env.SCRAPER_PYTHON, dir),
      dir,
      requestDelaySec: env.SCRAPER_REQUEST_DELAY_SEC,
      useTransfermarkt: ['1', 'true', 'yes', 'on'].includes(
        String(env.SCRAPER_USE_TRANSFERMARKT).toLowerCase(),
      ),
    };
  })(),
  fan: {
    continueTimeoutMs: env.FAN_CONTINUE_TIMEOUT_MS,
  },
  contentModeration: {
    blocklistPath: resolve(__dirname, '../..', env.CONTENT_MODERATION_BLOCKLIST),
  },
  careerSync: {
    ttlDays: env.CAREER_SYNC_TTL_DAYS,
    timeoutMs: env.CAREER_SYNC_TIMEOUT_MS,
    autoRefreshTmCookies: ['1', 'true', 'yes', 'on'].includes(
      String(env.CAREER_AUTO_REFRESH_TM_COOKIES).toLowerCase(),
    ),
    tmCookieRefreshTimeoutSec: env.CAREER_TM_COOKIE_REFRESH_TIMEOUT_SEC,
  },
  relationship: {
    maxHops: env.RELATIONSHIP_MAX_HOPS,
  },
  aiRateLimit: {
    maxPerWindow: env.AI_RATE_LIMIT_MAX
      ?? (env.NODE_ENV === 'test' ? 0 : 10),
    windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  },
  nodeEnv: env.NODE_ENV,
  isTest: env.NODE_ENV === 'test',
};
