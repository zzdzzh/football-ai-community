-- 新增世界杯 (WC) 同步元数据
INSERT OR IGNORE INTO match_sync_meta (league_code, last_sync_at, last_error, status, requests_in_window, window_started_at)
VALUES ('WC', NULL, NULL, 'ok', 0, NULL);
