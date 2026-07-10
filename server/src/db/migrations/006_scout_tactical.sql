-- MVP-3 Scout & Tactical 表结构
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  position TEXT,
  date_of_birth TEXT,
  nationality TEXT,
  league_code TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_league_position ON players(league_code, position);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS player_stats_snapshots (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  league_code TEXT NOT NULL,
  season TEXT NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  penalties INTEGER DEFAULT 0,
  appearances INTEGER,
  synced_at TEXT NOT NULL,
  UNIQUE(player_id, league_code, season)
);

CREATE INDEX IF NOT EXISTS idx_player_stats_league_season_goals
  ON player_stats_snapshots(league_code, season, goals DESC);

CREATE TABLE IF NOT EXISTS player_sync_meta (
  league_code TEXT PRIMARY KEY,
  last_sync_at TEXT,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down')),
  players_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS message_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  message_id TEXT NOT NULL REFERENCES messages(id),
  helpful INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, message_id)
);

ALTER TABLE messages ADD COLUMN recommendations_json TEXT;
ALTER TABLE messages ADD COLUMN tactical_json TEXT;

INSERT OR IGNORE INTO player_sync_meta (league_code, last_sync_at, last_error, status, players_count)
VALUES
  ('PL', NULL, NULL, 'ok', 0),
  ('PD', NULL, NULL, 'ok', 0),
  ('BL1', NULL, NULL, 'ok', 0),
  ('SA', NULL, NULL, 'ok', 0),
  ('FL1', NULL, NULL, 'ok', 0),
  ('CL', NULL, NULL, 'ok', 0),
  ('WC', NULL, NULL, 'ok', 0);
