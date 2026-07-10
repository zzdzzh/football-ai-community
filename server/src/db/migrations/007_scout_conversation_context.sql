-- 扩展 conversations.context_type 支持 league（Scout 联赛范围）
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS conversations_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_id TEXT NOT NULL REFERENCES agent_profiles(id),
  context_type TEXT NOT NULL CHECK (context_type IN ('match', 'team', 'general', 'league')),
  context_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO conversations_new
SELECT id, user_id, agent_id, context_type, context_id, title, created_at, updated_at
FROM conversations;

DROP TABLE conversations;

ALTER TABLE conversations_new RENAME TO conversations;

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

PRAGMA foreign_keys = ON;
