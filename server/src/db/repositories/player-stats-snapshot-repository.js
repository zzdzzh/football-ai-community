import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

const EXTRA_STAT_LABELS = {
  starts: '首发',
  shots: '射门',
  shotsOnTarget: '射正',
  interceptions: '拦截',
  tacklesWon: '抢断成功',
  yellowCards: '黄牌',
  redCards: '红牌',
  saves: '扑救',
  cleanSheets: '零封',
  goalsAgainst: '失球',
  plusMinus: '净胜球',
};

function parseExtraStats(raw) {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function mapPlayerStatsSnapshotRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    leagueCode: row.league_code,
    season: row.season,
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    penalties: row.penalties ?? 0,
    appearances: row.appearances ?? undefined,
    minutes: row.minutes ?? undefined,
    xg: row.xg ?? undefined,
    xa: row.xa ?? undefined,
    rating: row.rating ?? undefined,
    extraStats: parseExtraStats(row.extra_stats_json),
    syncedAt: row.synced_at,
  };
}

function serializeExtraStats(extraStats) {
  if (!extraStats || typeof extraStats !== 'object') return null;
  const cleaned = {};
  for (const [key, value] of Object.entries(extraStats)) {
    if (value == null) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

export function upsertPlayerStatsSnapshot(snapshot) {
  const db = getDb();
  const id = snapshot.id ?? randomUUID();
  const now = new Date().toISOString();
  const extraJson = serializeExtraStats(snapshot.extraStats);
  db.prepare(`
    INSERT INTO player_stats_snapshots (
      id, player_id, league_code, season, goals, assists, penalties, appearances,
      minutes, xg, xa, rating, extra_stats_json, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, league_code, season) DO UPDATE SET
      goals = excluded.goals,
      assists = excluded.assists,
      penalties = excluded.penalties,
      appearances = COALESCE(excluded.appearances, player_stats_snapshots.appearances),
      minutes = COALESCE(excluded.minutes, player_stats_snapshots.minutes),
      xg = COALESCE(excluded.xg, player_stats_snapshots.xg),
      xa = COALESCE(excluded.xa, player_stats_snapshots.xa),
      rating = COALESCE(excluded.rating, player_stats_snapshots.rating),
      extra_stats_json = COALESCE(excluded.extra_stats_json, player_stats_snapshots.extra_stats_json),
      synced_at = excluded.synced_at
  `).run(
    id,
    snapshot.playerId,
    snapshot.leagueCode,
    snapshot.season,
    snapshot.goals ?? 0,
    snapshot.assists ?? 0,
    snapshot.penalties ?? 0,
    snapshot.appearances ?? null,
    snapshot.minutes ?? null,
    snapshot.xg ?? null,
    snapshot.xa ?? null,
    snapshot.rating ?? null,
    extraJson,
    snapshot.syncedAt ?? now,
  );
  return findPlayerStatsSnapshot(snapshot.playerId, snapshot.leagueCode, snapshot.season);
}

export function findPlayerStatsSnapshot(playerId, leagueCode, season) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM player_stats_snapshots
    WHERE player_id = ? AND league_code = ? AND season = ?
  `).get(playerId, leagueCode, season);
  return row ? mapPlayerStatsSnapshotRow(row) : null;
}

export function listPlayerStatsSnapshots(playerId, { leagueCode = null, season = null } = {}) {
  const db = getDb();
  const conditions = ['player_id = ?'];
  const params = [playerId];

  if (leagueCode) {
    conditions.push('league_code = ?');
    params.push(leagueCode);
  }
  if (season) {
    conditions.push('season = ?');
    params.push(season);
  }

  const rows = db.prepare(`
    SELECT * FROM player_stats_snapshots
    WHERE ${conditions.join(' AND ')}
    ORDER BY season DESC, goals DESC
  `).all(...params);
  return rows.map(mapPlayerStatsSnapshotRow);
}

/** 快照“信息丰富度”评分，用于在多赛季行中优选可展示的关键数据。 */
export function scoreSnapshotRichness(snapshot) {
  if (!snapshot) return -1;
  let score = 0;
  if (snapshot.minutes != null) score += 20;
  if (snapshot.rating != null) score += 15;
  if (snapshot.xg != null) score += 8;
  if (snapshot.xa != null) score += 8;
  if (snapshot.extraStats && Object.keys(snapshot.extraStats).length > 0) score += 15;
  if (snapshot.appearances != null) score += 5;
  if ((snapshot.assists ?? 0) > 0) score += 5;
  if ((snapshot.goals ?? 0) > 0) score += 3;
  if ((snapshot.penalties ?? 0) > 0) score += 1;
  // 形如 25-26 的赛季标签通常来自当前赛季 scraper，略优先于历史开赛年行
  if (typeof snapshot.season === 'string' && /^\d{2}-\d{2}$/.test(snapshot.season)) {
    score += 12;
  }
  return score;
}

/** 从多赛季快照中选出信息最丰富的一条，供 Scout / 球员详情使用。 */
export function pickBestPlayerStatsSnapshot(snapshots = []) {
  if (!snapshots.length) return null;
  return snapshots.reduce((best, current) => (
    scoreSnapshotRichness(current) > scoreSnapshotRichness(best) ? current : best
  ));
}

export function mapSnapshotToPlayerStats(snapshot) {
  const stats = [];
  const push = (name, value) => {
    if (value == null) return;
    stats.push({ name, value });
  };

  push('进球', snapshot.goals);
  push('助攻', snapshot.assists);
  // 点球为 0 时不占用 keyStats 槽位，避免推荐卡片只剩下进球/出场/点球
  if ((snapshot.penalties ?? 0) > 0) {
    push('点球', snapshot.penalties);
  }
  push('出场', snapshot.appearances);
  push('出场分钟', snapshot.minutes);
  push('xG', snapshot.xg);
  push('xA', snapshot.xa);
  push('评分', snapshot.rating);

  const extra = snapshot.extraStats;
  if (extra) {
    for (const [key, label] of Object.entries(EXTRA_STAT_LABELS)) {
      if (extra[key] != null) {
        push(label, extra[key]);
      }
    }
  }
  return stats;
}
