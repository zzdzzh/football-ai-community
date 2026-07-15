import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),
  DATABASE_PATH: z.string().default('./data/community.db'),
  AI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: z.coerce.number().default(28000),
  AI_MAX_RETRIES: z.coerce.number().default(4),
  AI_RETRY_DELAYS_MS: z.string().default('3000,5000,8000,12000'),
  NEWS_SUMMARY_DELAY_MS: z.coerce.number().default(1500),
  INTERNAL_API_KEY: z.string().default('dev-internal-key'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  FOOTBALL_DATA_API_KEY: z.string().default(''),
  FOOTBALL_DATA_BASE_URL: z.string().url().default('https://api.football-data.org/v4'),
  MATCH_SYNC_CRON: z.string().default('*/30 * * * *'),
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
  CAREER_SYNC_TIMEOUT_MS: z.coerce.number().default(20000),
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
  newsSummaryDelayMs: env.NEWS_SUMMARY_DELAY_MS,
  internalApiKey: env.INTERNAL_API_KEY,
  adminEmail: env.ADMIN_EMAIL,
  adminPassword: env.ADMIN_PASSWORD,
  footballData: {
    apiKey: env.FOOTBALL_DATA_API_KEY,
    baseUrl: env.FOOTBALL_DATA_BASE_URL,
    wcSeason: env.FOOTBALL_DATA_WC_SEASON,
  },
  matchSyncCron: env.MATCH_SYNC_CRON,
  matchReportCron: env.MATCH_REPORT_CRON,
  playerSyncCron: env.PLAYER_SYNC_CRON,
  dataSource: env.NODE_ENV === 'test' ? 'football-data' : env.DATA_SOURCE,
  scraper: {
    pythonPath: env.SCRAPER_PYTHON,
    dir: resolve(__dirname, '../..', env.SCRAPER_DIR),
    requestDelaySec: env.SCRAPER_REQUEST_DELAY_SEC,
    useTransfermarkt: ['1', 'true', 'yes', 'on'].includes(
      String(env.SCRAPER_USE_TRANSFERMARKT).toLowerCase(),
    ),
  },
  fan: {
    continueTimeoutMs: env.FAN_CONTINUE_TIMEOUT_MS,
  },
  contentModeration: {
    blocklistPath: resolve(__dirname, '../..', env.CONTENT_MODERATION_BLOCKLIST),
  },
  careerSync: {
    ttlDays: env.CAREER_SYNC_TTL_DAYS,
    timeoutMs: env.CAREER_SYNC_TIMEOUT_MS,
  },
  relationship: {
    maxHops: env.RELATIONSHIP_MAX_HOPS,
  },
  nodeEnv: env.NODE_ENV,
  isTest: env.NODE_ENV === 'test',
};
