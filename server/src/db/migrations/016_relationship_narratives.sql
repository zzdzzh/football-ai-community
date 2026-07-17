-- 007 关系分析 LLM 叙事：独立叙事表 + relationship Agent 种子（仅 CREATE / INSERT，不 ALTER 005 结论表）
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS relationship_narratives (
  id TEXT PRIMARY KEY,
  player_id_low TEXT NOT NULL,
  player_id_high TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  analysis_computed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'failed')),
  narrative_text TEXT,
  model TEXT,
  prompt_version TEXT,
  claims_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (analysis_id, analysis_computed_at)
);

CREATE INDEX IF NOT EXISTS idx_relationship_narratives_player_pair
  ON relationship_narratives(player_id_low, player_id_high);
CREATE INDEX IF NOT EXISTS idx_relationship_narratives_analysis_id
  ON relationship_narratives(analysis_id);
CREATE INDEX IF NOT EXISTS idx_relationship_narratives_created_at
  ON relationship_narratives(created_at DESC);

INSERT OR IGNORE INTO agent_profiles (
  id, display_name, description, enabled, timeout_ms, created_at, updated_at
) VALUES (
  'relationship',
  '关系叙事 Agent',
  '基于已入库履历与球员对结构化关系结论，生成一次性简体中文关系介绍',
  1,
  45000,
  '2026-07-17T00:00:00.000Z',
  '2026-07-17T00:00:00.000Z'
);
