-- SofaScore 评分 + 比赛阵容/阵型
PRAGMA foreign_keys = ON;

ALTER TABLE player_stats_snapshots ADD COLUMN rating REAL;
ALTER TABLE matches ADD COLUMN lineups_json TEXT;
