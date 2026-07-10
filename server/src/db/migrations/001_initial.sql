-- MVP-1 初始表结构
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  timeout_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_items (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  key_points TEXT,
  event_key TEXT,
  related_to TEXT REFERENCES feed_items(id),
  visibility TEXT NOT NULL DEFAULT 'public',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_items_published_at ON feed_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_agent_id ON feed_items(agent_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_event_key ON feed_items(event_key);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  followed_teams TEXT NOT NULL DEFAULT '[]',
  followed_leagues TEXT NOT NULL DEFAULT '[]',
  enabled_agents TEXT NOT NULL,
  notify_match_report INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_cache_meta (
  source_id TEXT PRIMARY KEY,
  last_fetch_at TEXT,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down'))
);

CREATE TABLE IF NOT EXISTS agent_interaction_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  agent_id TEXT NOT NULL REFERENCES agent_profiles(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('generate', 'cron')),
  status TEXT NOT NULL CHECK (status IN ('success', 'timeout', 'error', 'degraded')),
  duration_ms INTEGER NOT NULL,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
