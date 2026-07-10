import { getDb } from '../db/connection.js';

export function dedupeFeedItemsBySourceUrl() {
  const db = getDb();
  const duplicateGroups = db.prepare(`
    SELECT source_url
    FROM feed_items
    WHERE source_url IS NOT NULL AND related_to IS NULL
    GROUP BY source_url
    HAVING COUNT(*) > 1
  `).all();

  let mergedCount = 0;

  for (const { source_url: sourceUrl } of duplicateGroups) {
    const rows = db.prepare(`
      SELECT id
      FROM feed_items
      WHERE source_url = ? AND related_to IS NULL
      ORDER BY created_at ASC
    `).all(sourceUrl);

    const [parent, ...duplicates] = rows;
    if (!parent || duplicates.length === 0) continue;

    const update = db.prepare('UPDATE feed_items SET related_to = ? WHERE id = ?');
    for (const duplicate of duplicates) {
      update.run(parent.id, duplicate.id);
      mergedCount += 1;
    }
  }

  return { mergedCount };
}
