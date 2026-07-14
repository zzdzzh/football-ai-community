-- 扩展球员统计快照：射门/防守/门将等 FBref 扩展指标（JSON）
PRAGMA foreign_keys = ON;

ALTER TABLE player_stats_snapshots ADD COLUMN extra_stats_json TEXT;
