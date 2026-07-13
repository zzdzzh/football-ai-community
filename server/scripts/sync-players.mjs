import { runMigrations } from '../src/db/migrate.js';
import { executePlayerSyncJob, getLeaguesNeedingPlayerSync } from '../src/jobs/player-sync.js';
import { getDb, closeDb } from '../src/db/connection.js';

runMigrations();

const league = process.argv[2] ?? null;
const pending = getLeaguesNeedingPlayerSync();
console.log('待同步联赛:', pending.join(', ') || '(无)');

const results = await executePlayerSyncJob(league ? { league } : {});
console.log('sync results:', JSON.stringify(results, null, 2));

const db = getDb();
const byLeague = db.prepare(`
  SELECT league_code, COUNT(*) AS players
  FROM players
  GROUP BY league_code
  ORDER BY league_code
`).all();
const meta = db.prepare(`
  SELECT league_code, players_count, last_sync_at, status, last_error
  FROM player_sync_meta
  ORDER BY league_code
`).all();

console.log(JSON.stringify({ byLeague, meta }, null, 2));
closeDb();
