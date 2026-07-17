-- 006 球员实体对齐：映射层三表（仅 CREATE，不 ALTER/MERGE 003/005 球员表）
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS player_identity_links (
  id TEXT PRIMARY KEY,
  stats_player_id TEXT NOT NULL,
  career_player_id TEXT NOT NULL,
  match_basis TEXT NOT NULL,
  match_key TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (status IN ('active', 'conflict_shelved', 'invalid')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (stats_player_id, career_player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_identity_links_stats_player_id
  ON player_identity_links(stats_player_id);
CREATE INDEX IF NOT EXISTS idx_player_identity_links_career_player_id
  ON player_identity_links(career_player_id);
CREATE INDEX IF NOT EXISTS idx_player_identity_links_match_key
  ON player_identity_links(match_key);
CREATE INDEX IF NOT EXISTS idx_player_identity_links_status_confidence
  ON player_identity_links(status, confidence);

CREATE TABLE IF NOT EXISTS player_identity_conflicts (
  id TEXT PRIMARY KEY,
  match_basis TEXT NOT NULL,
  match_key TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('stats', 'career', 'both')),
  candidate_stats_ids_json TEXT NOT NULL,
  candidate_career_ids_json TEXT NOT NULL,
  detail TEXT,
  detected_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_player_identity_conflicts_match_key
  ON player_identity_conflicts(match_key);
CREATE INDEX IF NOT EXISTS idx_player_identity_conflicts_detected_at
  ON player_identity_conflicts(detected_at);

CREATE TABLE IF NOT EXISTS player_identity_align_runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'api', 'internal')),
  created_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  notes TEXT
);
