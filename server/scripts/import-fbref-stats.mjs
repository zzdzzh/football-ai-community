/**
 * 从 scraper fbref-stats CLI 导入 FBref（soccerdata）统计到本地 DB。
 * 用法: node scripts/import-fbref-stats.mjs PD 2024
 */
import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { closeDb, getDb } from '../src/db/connection.js';
import { mergeFbrefStatsForLeague } from '../src/services/fbref-stats-import.js';

const leagueCode = process.argv[2] || 'PD';
const seasonYear = process.argv[3] ? Number(process.argv[3]) : 2024;
const outFile = resolve(config.scraper.dir, `_fbref_${leagueCode}_${seasonYear}.json`);

function runFbrefCli() {
  const args = [
    '-u', '-m', 'scraper', 'fbref-stats',
    '--league', leagueCode,
    '--season-year', String(seasonYear),
    '--out', outFile,
  ];
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(config.scraper.pythonPath, args, {
      cwd: config.scraper.dir,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    proc.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('爬虫超时'));
    }, 180000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`exit ${code}: ${stdout}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(readFileSync(outFile, 'utf8')));
      } catch (err) {
        reject(err);
      }
    });
  });
}

runMigrations();
console.log(`python=${config.scraper.pythonPath}`);
console.log(`out=${outFile}`);
console.log(`fetching ${leagueCode} season ${seasonYear}...`);
const payload = await runFbrefCli();
const now = new Date().toISOString();
const result = mergeFbrefStatsForLeague({
  leagueCode,
  season: payload.season || String(seasonYear),
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

try { unlinkSync(outFile); } catch { /* ignore */ }
closeDb();
