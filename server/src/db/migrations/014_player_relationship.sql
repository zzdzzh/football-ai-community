-- 005 球员关系分析：履历域表（独立于 003 players）
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS career_clubs (
  id TEXT PRIMARY KEY,
  external_source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (external_source, external_id)
);

CREATE TABLE IF NOT EXISTS career_players (
  id TEXT PRIMARY KEY,
  external_source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  date_of_birth TEXT,
  nationality TEXT,
  position TEXT,
  current_club_id TEXT REFERENCES career_clubs(id),
  current_club_name TEXT,
  synced_at TEXT,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('ready', 'stale', 'syncing', 'failed')),
  last_sync_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (external_source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_career_players_name_normalized ON career_players(name_normalized);
CREATE INDEX IF NOT EXISTS idx_career_players_synced_at ON career_players(synced_at);

CREATE TABLE IF NOT EXISTS club_stints (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES career_players(id),
  club_id TEXT NOT NULL REFERENCES career_clubs(id),
  joined_raw TEXT,
  left_raw TEXT,
  joined_on TEXT,
  left_on TEXT,
  time_precision TEXT NOT NULL CHECK (
    time_precision IN ('exact', 'month', 'year', 'season', 'open_ended', 'unparseable')
  ),
  transfer_type TEXT,
  transfer_fee TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_club_stints_player_id ON club_stints(player_id);
CREATE INDEX IF NOT EXISTS idx_club_stints_club_id ON club_stints(club_id);
CREATE INDEX IF NOT EXISTS idx_club_stints_club_player ON club_stints(club_id, player_id);

CREATE TABLE IF NOT EXISTS national_team_stints (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES career_players(id),
  nation_key TEXT NOT NULL,
  nation_name TEXT NOT NULL,
  joined_raw TEXT,
  left_raw TEXT,
  joined_on TEXT,
  left_on TEXT,
  time_precision TEXT NOT NULL CHECK (
    time_precision IN ('exact', 'month', 'year', 'season', 'open_ended', 'unparseable')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_national_team_stints_player_id ON national_team_stints(player_id);
CREATE INDEX IF NOT EXISTS idx_national_team_stints_nation_key ON national_team_stints(nation_key);

CREATE TABLE IF NOT EXISTS player_pair_analyses (
  id TEXT PRIMARY KEY,
  player_id_low TEXT NOT NULL REFERENCES career_players(id),
  player_id_high TEXT NOT NULL REFERENCES career_players(id),
  result_json TEXT NOT NULL,
  data_freshness_json TEXT NOT NULL,
  max_hops INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (player_id_low, player_id_high),
  CHECK (player_id_low < player_id_high)
);

CREATE INDEX IF NOT EXISTS idx_player_pair_analyses_computed_at
  ON player_pair_analyses(computed_at DESC);
