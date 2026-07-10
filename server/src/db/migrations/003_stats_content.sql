-- MVP-2 Stats & Content 表结构
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  tla TEXT,
  crest_url TEXT,
  league_code TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_league_code ON teams(league_code);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  league_code TEXT NOT NULL,
  season TEXT,
  matchday INTEGER,
  utc_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED')),
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  stats_json TEXT,
  events_json TEXT,
  data_completeness TEXT NOT NULL DEFAULT 'pending' CHECK (data_completeness IN ('complete', 'partial', 'pending')),
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_league_date ON matches(league_code, utc_date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_id TEXT NOT NULL REFERENCES agent_profiles(id),
  context_type TEXT NOT NULL CHECK (context_type IN ('match', 'team', 'general')),
  context_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metrics_json TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  missing_fields_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS match_sync_meta (
  league_code TEXT PRIMARY KEY,
  last_sync_at TEXT,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down')),
  requests_in_window INTEGER DEFAULT 0,
  window_started_at TEXT
);

ALTER TABLE feed_items ADD COLUMN match_id TEXT REFERENCES matches(id);
ALTER TABLE feed_items ADD COLUMN body_json TEXT;
ALTER TABLE feed_items ADD COLUMN data_sources_json TEXT;

INSERT OR IGNORE INTO match_sync_meta (league_code, last_sync_at, last_error, status, requests_in_window, window_started_at)
VALUES
  ('PL', NULL, NULL, 'ok', 0, NULL),
  ('PD', NULL, NULL, 'ok', 0, NULL),
  ('BL1', NULL, NULL, 'ok', 0, NULL),
  ('SA', NULL, NULL, 'ok', 0, NULL),
  ('FL1', NULL, NULL, 'ok', 0, NULL),
  ('CL', NULL, NULL, 'ok', 0, NULL);
