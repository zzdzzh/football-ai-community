-- 主条目 source_url 唯一，防止并发抓取重复入库
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_primary_source_url
ON feed_items(source_url)
WHERE source_url IS NOT NULL AND related_to IS NULL;
