import { getDb } from '../db/connection.js';
import { config } from '../config/index.js';

function preferScraperId() {
  return config.dataSource === 'scraper';
}

function rankRow(row) {
  let score = 0;
  if (row.status === 'FINISHED') score += 100;
  else if (row.status === 'LIVE' || row.status === 'IN_PLAY') score += 50;
  if (row.stats_json) score += 30;
  if (row.events_json) score += 10;
  if (preferScraperId()) {
    if (String(row.id).startsWith('ss-')) score += 20;
  } else if (!String(row.id).startsWith('ss-')) {
    score += 20;
  }
  return score;
}

function remapMatchReferences(db, fromId, toId) {
  db.prepare('UPDATE feed_items SET match_id = ? WHERE match_id = ?').run(toId, fromId);
  db.prepare('UPDATE fan_discussions SET match_id = ? WHERE match_id = ?').run(toId, fromId);
  db.prepare(`
    UPDATE conversations
    SET context_id = ?
    WHERE context_type = 'match' AND context_id = ?
  `).run(toId, fromId);
}

/**
 * 清除同一场比赛多 ID 重复行（常见于 football-data 数字 ID 与 scraper ss-* 并存）。
 * @returns {{ removedCount: number, groupCount: number }}
 */
export function dedupeMatchesByFixtureKey() {
  const db = getDb();
  const groups = db.prepare(`
    SELECT league_code, home_team_id, away_team_id, date(utc_date) AS match_day
    FROM matches
    GROUP BY league_code, home_team_id, away_team_id, date(utc_date)
    HAVING COUNT(*) > 1
  `).all();

  let removedCount = 0;

  const cleanup = db.transaction(() => {
    for (const group of groups) {
      const rows = db.prepare(`
        SELECT *
        FROM matches
        WHERE league_code = ?
          AND home_team_id = ?
          AND away_team_id = ?
          AND date(utc_date) = date(?)
      `).all(
        group.league_code,
        group.home_team_id,
        group.away_team_id,
        group.match_day,
      );

      if (rows.length < 2) continue;

      const ranked = [...rows].sort((a, b) => rankRow(b) - rankRow(a));
      const keep = ranked[0];
      const drop = ranked.slice(1);

      for (const loser of drop) {
        // 合并更完整的比分/状态到保留行
        if (
          (keep.home_score == null && loser.home_score != null)
          || (keep.status !== 'FINISHED' && loser.status === 'FINISHED')
        ) {
          db.prepare(`
            UPDATE matches SET
              status = CASE WHEN ? = 'FINISHED' THEN 'FINISHED' ELSE status END,
              home_score = COALESCE(home_score, ?),
              away_score = COALESCE(away_score, ?),
              utc_date = COALESCE(?, utc_date),
              stats_json = COALESCE(stats_json, ?),
              events_json = COALESCE(events_json, ?),
              lineups_json = COALESCE(lineups_json, ?),
              updated_at = ?
            WHERE id = ?
          `).run(
            loser.status,
            loser.home_score,
            loser.away_score,
            loser.utc_date,
            loser.stats_json,
            loser.events_json,
            loser.lineups_json,
            new Date().toISOString(),
            keep.id,
          );
        }
        remapMatchReferences(db, loser.id, keep.id);
        db.prepare('DELETE FROM matches WHERE id = ?').run(loser.id);
        removedCount += 1;
      }
    }
  });

  cleanup();
  return { removedCount, groupCount: groups.length };
}
