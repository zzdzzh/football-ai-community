import { getDb } from '../../src/db/connection.js';

export function seedScoutPlayers() {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
    VALUES ('57', 'Arsenal FC', 'PL', ?), ('61', 'Chelsea FC', 'PL', ?), ('80', 'Real Madrid', 'PD', ?)
  `).run(now, now, now);

  const players = [
    ['p1', 'Bukayo Saka', '57', 'Right Winger', '2001-09-05', 'England', 'PL'],
    ['p2', 'Martin Ødegaard', '57', 'Central Midfield', '1998-12-17', 'Norway', 'PL'],
    ['p3', 'Declan Rice', '57', 'Central Midfield', '1999-01-14', 'England', 'PL'],
    ['p4', 'Cole Palmer', '61', 'Attacking Midfield', '2002-05-06', 'England', 'PL'],
    ['p5', 'Pedri', '80', 'Central Midfield', '2002-11-25', 'Spain', 'PD'],
  ];

  for (const [id, name, teamId, position, dob, nationality, league] of players) {
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, teamId, position, dob, nationality, league, now);
  }

  const stats = [
    ['s1', 'p1', 'PL', '2026', 10, 5, 0, 30],
    ['s2', 'p2', 'PL', '2026', 5, 8, 0, 28],
    ['s3', 'p3', 'PL', '2026', 3, 4, 0, 32],
    ['s4', 'p4', 'PL', '2026', 12, 6, 2, 30],
    ['s5', 'p5', 'PD', '2026', 4, 7, 0, 25],
  ];

  for (const [id, playerId, league, season, goals, assists, penalties, apps] of stats) {
    db.prepare(`
      INSERT OR REPLACE INTO player_stats_snapshots (
        id, player_id, league_code, season, goals, assists, penalties, appearances, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, playerId, league, season, goals, assists, penalties, apps, now);
  }

  return { teamId: '57', leagueCode: 'PL' };
}
