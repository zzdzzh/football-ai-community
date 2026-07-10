-- 爬虫数据源外部 ID 映射
PRAGMA foreign_keys = ON;

ALTER TABLE teams ADD COLUMN sofascore_id TEXT;
ALTER TABLE teams ADD COLUMN transfermarkt_id TEXT;
ALTER TABLE teams ADD COLUMN fbref_id TEXT;

CREATE INDEX IF NOT EXISTS idx_teams_sofascore_id ON teams(sofascore_id);
CREATE INDEX IF NOT EXISTS idx_teams_transfermarkt_id ON teams(transfermarkt_id);

ALTER TABLE players ADD COLUMN transfermarkt_id TEXT;
ALTER TABLE players ADD COLUMN fbref_id TEXT;
ALTER TABLE players ADD COLUMN sofascore_id TEXT;

CREATE INDEX IF NOT EXISTS idx_players_transfermarkt_id ON players(transfermarkt_id);
CREATE INDEX IF NOT EXISTS idx_players_fbref_id ON players(fbref_id);
