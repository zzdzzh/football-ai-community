import { ALLOWED_LEAGUES } from '../constants/league-codes.js';
import { findTeamById } from '../db/repositories/team-repository.js';
import { searchPlayers, calcPlayerAge, countPlayersByLeague, searchPlayersByTeamLeague } from '../db/repositories/player-repository.js';
import {
  listPlayerStatsSnapshots,
  mapSnapshotToPlayerStats,
} from '../db/repositories/player-stats-snapshot-repository.js';
import {
  getAggregatePlayerSyncStatus,
  findPlayerSyncMetaByLeague,
  getAllPlayerSyncMeta,
} from '../db/repositories/player-sync-meta-repository.js';

const CANDIDATE_CAP = 50;
const BROAD_POOL_THRESHOLD = 5;
const PLAYER_DATA_NOT_SYNCED_MESSAGE = '球员数据尚未同步，请稍后再试（首次同步约需数分钟）';

function isLeaguePlayerDataNeverSynced(leagueCode) {
  const meta = findPlayerSyncMetaByLeague(leagueCode);
  if (meta?.lastSyncAt && (meta.playersCount ?? 0) > 0) {
    return false;
  }
  if (leagueCode === 'CL') {
    return searchPlayersByTeamLeague('CL', { page: 1, pageSize: 1 }).total === 0;
  }
  return !meta?.lastSyncAt && countPlayersByLeague(leagueCode) === 0;
}

function isGlobalPlayerDataNeverSynced() {
  const result = searchPlayers({ page: 1, pageSize: 1 });
  if (result.total > 0) {
    return false;
  }
  const metas = getAllPlayerSyncMeta();
  return metas.length === 0 || metas.every((meta) => !meta.lastSyncAt);
}

export function parseMaxAgeFromQuestion(question) {
  if (!question) return null;
  const match = question.match(/(\d{1,2})\s*岁\s*以下|under\s*(\d{1,2})|≤\s*(\d{1,2})/i);
  if (!match) return null;
  const age = Number(match[1] ?? match[2] ?? match[3]);
  return Number.isNaN(age) ? null : age;
}

export function parseMinAgeFromQuestion(question) {
  if (!question) return null;
  const match = question.match(
    /(\d{1,2})\s*岁\s*以上|over\s*(\d{1,2})|≥\s*(\d{1,2})|至少\s*(\d{1,2})\s*岁/i,
  );
  if (!match) return null;
  const age = Number(match[1] ?? match[2] ?? match[3] ?? match[4]);
  return Number.isNaN(age) ? null : age;
}

export function parsePositionFromQuestion(question) {
  if (!question) return null;
  const keywords = ['中场', '前锋', '后卫', '门将', '边锋', 'Midfield', 'Forward', 'Defender', 'Goalkeeper', 'Winger'];
  return keywords.find((kw) => question.includes(kw)) ?? null;
}

function mapCandidate(player) {
  const snapshots = listPlayerStatsSnapshots(player.id, { leagueCode: player.leagueCode });
  const stats = snapshots.length > 0 ? mapSnapshotToPlayerStats(snapshots[0]) : [];
  return {
    id: player.id,
    name: player.name,
    teamId: player.teamId,
    teamName: player.teamName,
    position: player.position,
    age: player.age,
    leagueCode: player.leagueCode,
    stats,
  };
}

const POSITION_ALIASES = {
  中场: ['midfield'],
  前锋: ['forward', 'striker', 'attacking'],
  后卫: ['defender', 'back'],
  门将: ['goalkeeper'],
  边锋: ['winger'],
};

function resolvePositionSqlKeyword(keyword) {
  const sqlTerms = {
    中场: 'Midfield',
    前锋: 'Forward',
    后卫: 'Defender',
    门将: 'Goalkeeper',
    边锋: 'Winger',
    Midfield: 'Midfield',
    Forward: 'Forward',
    Defender: 'Defender',
    Goalkeeper: 'Goalkeeper',
    Winger: 'Winger',
  };
  return sqlTerms[keyword] ?? keyword;
}

function matchPosition(playerPosition, keyword) {
  if (!keyword) return true;
  if (!playerPosition) return false;
  const lower = playerPosition.toLowerCase();
  const aliases = POSITION_ALIASES[keyword] ?? [keyword.toLowerCase()];
  return aliases.some((alias) => lower.includes(alias));
}

function filterCandidates(candidates, { maxAge = null, minAge = null, position = null } = {}) {
  let filtered = candidates;
  if (maxAge != null) {
    filtered = filtered.filter((c) => c.age != null && c.age <= maxAge);
  }
  if (minAge != null) {
    // 缺生日数据时保留候选，由 AI 说明无法确认年龄
    filtered = filtered.filter((c) => c.age == null || c.age >= minAge);
  }
  if (position) {
    filtered = filtered.filter((c) => matchPosition(c.position, position));
  }
  return filtered;
}

function searchLeagueCandidates(leagueCode, { position = null } = {}) {
  const positionTerm = position ? resolvePositionSqlKeyword(position) : null;
  if (leagueCode === 'CL') {
    return searchPlayersByTeamLeague('CL', { page: 1, pageSize: CANDIDATE_CAP });
  }
  return searchPlayers({
    league: leagueCode,
    position: positionTerm,
    page: 1,
    pageSize: CANDIDATE_CAP,
  });
}

export function buildScoutContext({ contextType, contextId, userQuestion = '' }) {
  const { status: syncStatus } = getAggregatePlayerSyncStatus();
  // 同步任务失败但库内仍有历史数据时，允许使用已有球员继续推荐
  if (syncStatus === 'down' && isGlobalPlayerDataNeverSynced()) {
    return { syncMessage: '球员数据同步暂不可用，请稍后再试' };
  }

  if (contextType === 'league') {
    if (!contextId || !ALLOWED_LEAGUES.includes(contextId)) {
      return { notFound: true };
    }
    if (isLeaguePlayerDataNeverSynced(contextId)) {
      return { syncMessage: PLAYER_DATA_NOT_SYNCED_MESSAGE };
    }
    const maxAge = parseMaxAgeFromQuestion(userQuestion);
    const minAge = parseMinAgeFromQuestion(userQuestion);
    const position = parsePositionFromQuestion(userQuestion);
    const result = searchLeagueCandidates(contextId, { position });
    const candidates = result.items.map(mapCandidate);
    const filtered = filterCandidates(candidates, { maxAge, minAge, position });
    return {
      contextType,
      contextId,
      leagueCode: contextId,
      candidates: filtered.slice(0, CANDIDATE_CAP),
      poolSize: filtered.length,
      tooBroad: filtered.length > BROAD_POOL_THRESHOLD,
      filters: { maxAge, minAge, position, leagueCode: contextId },
    };
  }

  if (contextType === 'team') {
    const team = findTeamById(contextId);
    if (!team) {
      return { notFound: true };
    }
    if (isLeaguePlayerDataNeverSynced(team.leagueCode)) {
      return { syncMessage: PLAYER_DATA_NOT_SYNCED_MESSAGE };
    }
    const maxAge = parseMaxAgeFromQuestion(userQuestion);
    const minAge = parseMinAgeFromQuestion(userQuestion);
    const position = parsePositionFromQuestion(userQuestion);
    const result = searchPlayers({
      teamId: contextId,
      position: position ? resolvePositionSqlKeyword(position) : null,
      page: 1,
      pageSize: CANDIDATE_CAP,
    });
    const candidates = result.items.map(mapCandidate);
    const filtered = filterCandidates(candidates, { maxAge, minAge, position });
    return {
      contextType,
      contextId,
      leagueCode: team.leagueCode,
      teamName: team.name,
      candidates: filtered.slice(0, CANDIDATE_CAP),
      poolSize: filtered.length,
      tooBroad: filtered.length > BROAD_POOL_THRESHOLD,
      filters: { maxAge, minAge, position, teamId: contextId },
    };
  }

  if (contextType === 'general') {
    if (isGlobalPlayerDataNeverSynced()) {
      return { syncMessage: PLAYER_DATA_NOT_SYNCED_MESSAGE };
    }
    const maxAge = parseMaxAgeFromQuestion(userQuestion);
    const minAge = parseMinAgeFromQuestion(userQuestion);
    const position = parsePositionFromQuestion(userQuestion);
    const result = searchPlayers({
      position: position ? resolvePositionSqlKeyword(position) : null,
      page: 1,
      pageSize: CANDIDATE_CAP,
    });
    const candidates = result.items.map(mapCandidate);
    const filtered = filterCandidates(candidates, { maxAge, minAge, position });
    return {
      contextType,
      contextId: null,
      candidates: filtered.slice(0, CANDIDATE_CAP),
      poolSize: filtered.length,
      tooBroad: filtered.length > BROAD_POOL_THRESHOLD,
      filters: { maxAge, minAge, position },
    };
  }

  return { invalid: true };
}

export { CANDIDATE_CAP, BROAD_POOL_THRESHOLD };
