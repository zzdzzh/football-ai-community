import {
  findPlayerById,
  searchPlayers,
} from '../db/repositories/player-repository.js';
import {
  listPlayerStatsSnapshots,
  mapSnapshotToPlayerStats,
} from '../db/repositories/player-stats-snapshot-repository.js';
import { getAggregatePlayerSyncStatus } from '../db/repositories/player-sync-meta-repository.js';

function toPlayerSummary(player) {
  return {
    id: player.id,
    name: player.name,
    teamId: player.teamId,
    teamName: player.teamName,
    position: player.position,
    age: player.age,
    nationality: player.nationality,
    leagueCode: player.leagueCode,
  };
}

export function searchPlayerSummaries(filters = {}) {
  const result = searchPlayers(filters);
  const { status: syncStatus } = getAggregatePlayerSyncStatus();
  return {
    items: result.items.map(toPlayerSummary),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    syncStatus,
  };
}

export function getPlayerDetail(playerId) {
  const player = findPlayerById(playerId);
  if (!player) return null;

  const snapshots = listPlayerStatsSnapshots(playerId);
  const stats = snapshots.length > 0
    ? mapSnapshotToPlayerStats(snapshots[0])
    : [];

  const { status: syncStatus } = getAggregatePlayerSyncStatus();
  const syncMessage = stats.length === 0 && syncStatus !== 'ok'
    ? '球员统计数据同步中，请稍后再试'
    : stats.length === 0
      ? '暂无统计数据'
      : undefined;

  return {
    ...toPlayerSummary(player),
    dateOfBirth: player.dateOfBirth ?? null,
    stats,
    syncMessage,
  };
}
