/**
 * 合并已下载的 FBref JSON 到 DB（不重新爬取）。
 * 用法: node scripts/merge-fbref-json.mjs D:/path/to/_fbref_PD_2024.json PD
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runMigrations } from '../src/db/migrate.js';
import { closeDb, getDb } from '../src/db/connection.js';
import { mergeFbrefStatsForLeague } from '../src/services/fbref-stats-import.js';

const file = resolve(process.argv[2]);
const leagueOverride = process.argv[3] || null;

runMigrations();
const payload = JSON.parse(readFileSync(file, 'utf8'));
const leagueCode = leagueOverride || payload.leagueCode;
const now = new Date().toISOString();
const result = mergeFbrefStatsForLeague({
  leagueCode,
  season: payload.season,
  fbrefStats: payload.fbrefStats || [],
  now,
});
const dob = getDb().prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN date_of_birth IS NULL OR date_of_birth = '' THEN 1 ELSE 0 END) AS dob_empty
  FROM players WHERE league_code = ?
`).get(leagueCode);
console.log(JSON.stringify({
  leagueCode,
  season: payload.season,
  fetched: payload.fbrefStats?.length ?? 0,
  ...result,
  dobCoverage: dob,
}, null, 2));
closeDb();
