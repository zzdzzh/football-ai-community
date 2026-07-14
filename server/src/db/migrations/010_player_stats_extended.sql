-- 扩展球员统计快照：FBref 高级指标
PRAGMA foreign_keys = ON;

ALTER TABLE player_stats_snapshots ADD COLUMN minutes INTEGER;
ALTER TABLE player_stats_snapshots ADD COLUMN xg REAL;
ALTER TABLE player_stats_snapshots ADD COLUMN xa REAL;
