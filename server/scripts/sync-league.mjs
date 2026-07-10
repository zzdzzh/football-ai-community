import { runMigrations } from '../src/db/migrate.js';
import { executeMatchSyncJob } from '../src/jobs/match-sync.js';
import { getDb, closeDb } from '../src/db/connection.js';

runMigrations();

const league = process.argv[2] ?? 'WC';
const results = await executeMatchSyncJob({ league });
console.log('sync results:', JSON.stringify(results, null, 2));

const db = getDb();
const wcCount = db.prepare("SELECT COUNT(*) AS c FROM matches WHERE league_code = ?").get(league);
const wcByStatus = db.prepare('SELECT status, COUNT(*) AS c FROM matches WHERE league_code = ? GROUP BY status').all(league);
const meta = db.prepare('SELECT status, last_error FROM match_sync_meta WHERE league_code = ?').get(league);

console.log(JSON.stringify({ league, count: wcCount, byStatus: wcByStatus, meta }, null, 2));
closeDb();
