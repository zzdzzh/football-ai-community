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
  },
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
  },
  nodeEnv: env.NODE_ENV,
  isTest: env.NODE_ENV === 'test',
};
