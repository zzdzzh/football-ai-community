import { config } from '../src/config/index.js';
import Database from 'better-sqlite3';

const db = new Database(config.databasePath);
const players = db.prepare(
  'SELECT league_code, COUNT(*) AS c FROM players GROUP BY league_code ORDER BY league_code',
).all();
const matches = db.prepare(`
  SELECT league_code,
         COUNT(*) AS c,
         SUM(CASE WHEN stats_json IS NOT NULL AND stats_json != '' THEN 1 ELSE 0 END) AS with_stats,
         SUM(CASE WHEN lineups_json IS NOT NULL AND lineups_json != '' THEN 1 ELSE 0 END) AS with_lineups
  FROM matches
  GROUP BY league_code
  ORDER BY league_code
`).all();
const pmeta = db.prepare(
  'SELECT league_code, status, players_count, last_sync_at, last_error FROM player_sync_meta ORDER BY league_code',
).all();
const mmeta = db.prepare(
  'SELECT league_code, status, last_sync_at, last_error FROM match_sync_meta ORDER BY league_code',
).all();
const totals = {
  players: db.prepare('SELECT COUNT(*) AS c FROM players').get().c,
  matches: db.prepare('SELECT COUNT(*) AS c FROM matches').get().c,
  withStats: db.prepare(`SELECT COUNT(*) AS c FROM matches WHERE stats_json IS NOT NULL AND stats_json != ''`).get().c,
};
console.log(JSON.stringify({ totals, players, matches, pmeta, mmeta }, null, 2));
db.close();
